# DeFi Lending Project

基于以太坊的借贷协议：双币种池（COL + BUSD）、存款凭证（PCOL/PBUSD）、超额抵押借贷、拐点利率模型、按 block 复利计息、分资产清算阈值、存款管理费、清算与闪电贷。前端通过 MetaMask 连接，提供 Dashboard、存/取/借/还、清算、闪电贷、利率测试等页面。

---

## 一、项目概览

- **主借贷池**：`PCOLBUSDPool` — 池内仅 COL 与 BUSD 两种 ERC-20；用户存入得凭证（PCOL/PBUSD），存入时收取 0.05% 管理费；可抵押凭证借出另一种币；价格由池内储备比例决定；债务按 block 复利计息；利率采用拐点模型（最优利用率 U_opt），清算阈值按抵押资产区分（PCOL 较低、PBUSD 较高）。
- **另一套实现**：`LendingPool` + `PriceOracle` — 通用抵押/借还/清算/闪电贷，价格来自 Chainlink 或 fallback，无凭证、无计息，供对比或扩展用。**当前前端与部署脚本均围绕 PCOLBUSDPool。**
- **前端**：React + Vite + ethers.js，连接 MetaMask，读写合约并展示仓位、健康系数、APY、池内余额、GOV 奖励等。

---

## 二、整体架构

```
用户 (MetaMask)
    ↓
前端 (React) ←→ 合约 (PCOLBUSDPool / LendingPool)
    ↓
ERC20: COL, BUSD | 凭证: PCOL, PBUSD | GovernanceToken (GOV)
```

- **PCOLBUSDPool** 部署时创建并持有 **PCOL**、**PBUSD** 两个 ReceiptToken；池子同时持有 **GovernanceToken**，用于存款/借款奖励。
- **COL**：波动资产（测试用 MockERC20）；**BUSD**：稳定币（测试用 MockERC20，1:1 USD）。
- 价格：BUSD 固定 1e8（1 USD）；COL 价格由池内储备 `_priceCOLIn8() = (poolBUSD * 10^(8+dCOL)) / (poolCOL * 10^dBUSD)` 计算，8 位小数。

---

## 三、币种与凭证结构

| 名称 | 类型 | 说明 |
|------|------|------|
| **COL** | ERC20 | 波动资产，池内与 BUSD 组成储备；价格 = poolBUSD/poolCOL（8 位小数）。 |
| **BUSD** | ERC20 | 稳定币，1 USD；池内可借出或取出。 |
| **PCOL** | ReceiptToken | 池子铸造/销毁；代表“在池中存了多少 COL”；取款时 1:1 烧掉 PCOL 取回 COL。存入时扣 0.05% 管理费，实际获得 PCOL = 存入量 × 99.95%。 |
| **PBUSD** | ReceiptToken | 同上，代表“在池中存了多少 BUSD”；存入时扣 0.05% 管理费。 |
| **GovernanceToken (GOV)** | ERC20 | 治理/激励代币；池子在用户**每次存款**或**每次借款**时调用 `mintReward(user, amount)` 发放 GOV。前端 Dashboard Wallet 显示「GOV: xxx (存款/借款奖励)」。 |

- 凭证（PCOL/PBUSD）**不参与池子储备**，只代表对池子的债权；抵押时锁定凭证本身（转入池子），按池内价格折算抵押价值。

---

## 四、核心合约：PCOLBUSDPool

### 4.1 状态变量（主要）

| 变量 | 含义 |
|------|------|
| `tokenCOL`, `tokenBUSD` | 底层资产地址（immutable）。 |
| `pcolToken`, `pbusdToken` | 凭证合约（池子部署时创建，仅池子可 mint/burn）。 |
| `governanceToken` | 奖励代币，池子可 mintReward。 |
| `lockedPCOL[user]`, `lockedPBUSD[user]` | 用户锁定的抵押（PCOL 或 PBUSD 数量）。 |
| `scaledDebtBUSD[user]`, `scaledDebtCOL[user]` | 用户债务（按 borrowIndex 缩放存储）。 |
| `borrowIndexBUSD`, `borrowIndexCOL` | 债务指数，每 block 按利率复利增长；当前债务 = scaledDebt × index / 1e18。 |
| `lastBlockBUSD`, `lastBlockCOL` | 上次更新 index 的 block。 |
| `totalScaledDebtBUSD`, `totalScaledDebtCOL` | 全池缩放债务总和。 |
| **拐点利率** | `baseRatePerBlock*`, `slope1PerBlock*`, `slope2PerBlock*`, `optimalUtilization*`（BUSD U_opt≈85%，COL U_opt≈55%）。 |
| `reserveFactorBps*` | 储备金率（bps）；Supply APY = Borrow APY × u × (1 - reserveFactor)。 |
| **清算阈值** | `liquidationThresholdPCOL`（65%，PCOL 抵押借 BUSD）；`liquidationThresholdPBUSD`（85%，PBUSD 抵押借 COL）。 |
| `liquidationBonus` | 清算奖励（如 1000 = 10%）。 |
| `depositFeeBps` | 存款管理费（5 = 0.05%），留在池内；用户获得凭证 = 存入量 − 费用。 |
| `flashLoanFeeBps` | 闪电贷费率（如 9 = 0.09%）。 |
| `rewardPerDeposit`, `rewardPerBorrow` | 每次存款/借款发放的 GOV 数量。 |

### 4.2 价格与储备

- **储备**：`_getReserves()` → 池子合约持有的 COL、BUSD 余额。
- **COL 价格（8 位小数）**：`_priceCOLIn8()` = (rBUSD × 10^(8+dCOL)) / (rCOL × 10^dBUSD)。
- **BUSD 价格**：`_priceBUSDIn8()` = 1e8。
- 抵押价值（8 位）：PCOL 仓位 = lockedPCOL × _priceCOLIn8()；PBUSD 仓位 = lockedPBUSD × 1e8。

### 4.3 利率模型（拐点 Kinked）

- **利用率**（BUSD/COL 各自）：`u = totalDebt / (poolBalance + totalDebt)`（借出的币已离开池子）。
- **最优利用率 U_opt**：BUSD 稳定币约 85%（`optimalUtilizationBUSD`）；COL 波动资产约 55%（`optimalUtilizationCOL`）。
- **每 block 借款利率**（1e18）：
  - **u ≤ U_opt**：`rate = baseRate + slope1 × u`（平缓，鼓励借贷）。
  - **u > U_opt**：`rate = rateAtOpt + slope2 × (u − U_opt)`，其中 `rateAtOpt = base + slope1 × U_opt`（拐点后斜率大幅增加，防止流动性枯竭）。
- **计息**：每次 borrow/repay/liquidate 前调用 `_accrueBUSD()` / `_accrueCOL()`，用 `(1 + rate)^n` 更新 `borrowIndex`；债务 = scaledDebt × borrowIndex / 1e18。
- **Borrow APY（展示）**：单利年化 = ratePerBlock × BLOCKS_PER_YEAR；（apyWei/1e18）×100 = 百分比。
- **Supply APY**：Borrow APY × utilization × (1 − reserveFactorBps/BPS)。

### 4.4 核心操作与实现

#### 存款（Supply）

| 方法 | 实现 |
|------|------|
| `depositCOL(amount)` | 用户转 amount COL 进池；扣 0.05% 管理费留在池内；mint **amount − fee** 的 PCOL 给用户；可选 mintReward。 |
| `depositBUSD(amount)` | 同上，扣 0.05% 管理费；mint amount − fee 的 PBUSD。 |

#### 取款（Withdraw）

| 方法 | 实现 |
|------|------|
| `withdrawCOL(amount)` | 用户 burn PCOL；池子转等量 COL 给用户；需池子余额足够。 |
| `withdrawBUSD(amount)` | 用户 burn PBUSD；池子转等量 BUSD 给用户。 |

#### 抵押（Collateral）

| 方法 | 实现 |
|------|------|
| `depositCollateralPCOL(amount)` | 用户将 PCOL 转给池子；`lockedPCOL[user] += amount`。 |
| `withdrawCollateralPCOL(amount)` | 池子转回 PCOL；若有 BUSD 债务需 HF ≥ 1e18。 |
| `depositCollateralPBUSD(amount)` / `withdrawCollateralPBUSD(amount)` | 同上，锁定/解锁 PBUSD。 |

#### 借款（Borrow）与还款（Repay）

| 方法 | 实现 |
|------|------|
| `borrowBUSD(amount)` | 先 _accrueBUSD；要求有 PCOL 抵押、池子 BUSD 足够、**借后 HF ≥ 1e18**；增加 scaledDebt；池子将 BUSD 转给用户；可选 mintReward。 |
| `borrowCOL(amount)` | 先 _accrueCOL；要求有 PBUSD 抵押、池子 COL 足够、借后 HF ≥ 1e18；池子将 COL 转给用户。 |
| `repayBUSD(amount)` / `repayCOL(amount)` | 先 accrue；按当前 borrowIndex 还债，减少 scaledDebt；用户转资产进池。 |

#### 清算（Liquidation）

| 方法 | 实现 |
|------|------|
| `liquidateBUSD(user)` | 要求 getHealthFactorPCOL(user) < 1e18；清算人代还全部 BUSD 债务；获得该仓位锁定的 PCOL × (1 + liquidationBonus)；超出部分 PCOL 被 burn。 |
| `liquidateCOL(user)` | 要求 getHealthFactorPBUSD(user) < 1e18；清算人还 COL，获得锁定的 PBUSD（含 bonus）。 |

#### 闪电贷（Flash Loan）

| 方法 | 实现 |
|------|------|
| `flashLoan(receiver, asset, amount, params)` | asset 为 tokenCOL 或 tokenBUSD；fee = amount × flashLoanFeeBps/BPS；转 amount 给 receiver；回调 executeOperation；要求回调后池子余额 ≥ 借出前 + fee。 |

### 4.5 健康系数与最大可借

- **健康系数（1e18）**
  - **PCOL 借 BUSD**：`HF = (collateralValuePCOL × liquidationThresholdPCOL × 1e18) / (debtBUSD × 1e8 × BPS)`（阈值 65%）。
  - **PBUSD 借 COL**：`HF = (collateralValuePBUSD × liquidationThresholdPBUSD × 1e18) / (debtCOL × priceCOL × BPS)`（阈值 85%）。  
  HF < 1e18 表示可被清算。

- **最大可借（考虑价格冲击与整数舍入）**
  - `getMaxBorrowBUSD(user)` / `getMaxBorrowCOL(user)`：借出会改变池子储备从而改变价格；合约内用**与 getHealthFactor 完全一致的整数运算**模拟「借 x 后的 HF」，并对可借额**二分查找**，返回满足**借后 HF ≥ 1e18** 的最大 x，保证用户借到该值时不会立刻变为可清算。
  - 内部依赖：`_priceCOLIn8Hypothetical(rBUSD, rCOL)`、`_getHealthFactorPCOLAfterBorrowBUSD(user, addBorrow)`、`_getHealthFactorPBUSDAfterBorrowCOL(user, addBorrow)`。

### 4.6 只读与辅助接口（完整列表）

- 仓位：`getUserPositionPCOL(user)`, `getUserPositionPBUSD(user)`  
- 债务：`getCurrentDebtBUSD(user)`, `getCurrentDebtCOL(user)`  
- 指数：`getBorrowIndexBUSDView()`, `getBorrowIndexCOLView()`  
- 利用率：`getUtilizationBUSD()`, `getUtilizationCOL()`  
- 利率：`getBorrowRatePerBlockBUSD()`, `getBorrowRatePerBlockCOL()`  
- APY：`getBorrowAPYBUSD()`, `getBorrowAPYCOL()`, `getSupplyAPYBUSD()`, `getSupplyAPYCOL()`  
- 健康与清算：`getHealthFactorPCOL(user)`, `getHealthFactorPBUSD(user)`, `isLiquidatablePCOL(user)`, `isLiquidatablePBUSD(user)`  
- 最大可借：`getMaxBorrowBUSD(user)`, `getMaxBorrowCOL(user)`  
- 价格：`getPriceCOLIn8()`, `getPriceBUSDIn8()`  
- 闪电贷：`getFlashLoanFee(amount)`  
- 参数：`liquidationThresholdPCOL`, `liquidationThresholdPBUSD`, `liquidationBonus`, `depositFeeBps`；利率参数 `baseRatePerBlock*`, `slope1PerBlock*`, `slope2PerBlock*`, `optimalUtilization*`, `reserveFactorBps*`（public 可读）。

---

## 五、其他合约

### 5.1 ReceiptToken

- ERC20 子类；仅 `pool` 可 `mint`/`burn`。池子在 deposit 时 mint（**存入量 − 0.05% 管理费**），withdraw 时 burn 并 1:1 转回底层资产。

### 5.2 GovernanceToken (GOV)

- ERC20 + Ownable；`lendingPool` 由 owner 设置后，仅该池可调 `mintReward(to, amount)`。PCOLBUSDPool 在每次 depositCOL/depositBUSD、borrowBUSD/borrowCOL 时（若 reward > 0）发放 GOV。前端 Dashboard Wallet 显示 GOV 余额。

### 5.3 LendingPool（另一套实现）

- 单抵押 + 单借出资产；无凭证、无复利；价格来自 IPriceOracle。前端与部署**未使用**，仅作参考。

### 5.4 PriceOracle、FlashLoanReceiverExample、MockERC20、接口

- **PriceOracle**：getPrice(asset) 8 位小数；可配 Chainlink 或 fallback；供 LendingPool 使用。  
- **FlashLoanReceiverExample**：实现 executeOperation；requestFlashLoan 前需向本合约授权 fee；部署时传入 PCOLBUSDPool。  
- **MockERC20**：mint/faucet，用于测试 COL/BUSD。  
- **接口**：IFlashLoanReceiver、IPriceOracle、ILendingPool、IAggregatorV3。

---

## 六、前端功能与实现

### 6.1 钱包

- **WalletContext**：user、refreshUser；监听 accountsChanged、chainChanged。  
- **Header**：Connect MetaMask；未连接时各页提示先连接。  
- **web3.js**：getProvider、connectWallet、getPoolContract/getPoolContractReadOnly、各合约读/写封装。

### 6.2 页面与功能对应

| 页面 | 路径 | 功能 | 主要实现 |
|------|------|------|----------|
| **Dashboard** | `/` | 总览 | 池内 COL/BUSD 余额、利用率、Supply/Borrow APY、用户总抵押/总债务、健康系数（PCOL→BUSD、PBUSD→COL）、钱包余额（含 **GOV**）、各仓位卡片。 |
| **Deposit** | `/deposit` | 存款 | 选择 COL 或 BUSD；说明 0.05% 管理费；approve + depositCOL/depositBUSD。 |
| **Withdraw** | `/withdraw` | 取款 | 选择 COL 或 BUSD（PCOL/PBUSD）；withdrawCOL/withdrawBUSD。 |
| **Borrow** | `/borrow` | 抵押/解锁/借款 | 模式 PCOL（借 BUSD）或 PBUSD（借 COL）；操作 Lock/Unlock/Borrow；显示**双清算阈值**（PCOL→BUSD 65%、PBUSD→COL 85%）、健康系数、最大可借；**一键「最大」**填入最大可借；approve + depositCollateral* / withdrawCollateral* / borrowBUSD / borrowCOL。 |
| **Repay** | `/repay` | 还款 | 选择 BUSD 或 COL；显示债务与余额；repayBUSD/repayCOL。 |
| **Liquidate** | `/liquidate` | 清算 | 拉取曾抵押用户，过滤 HF < 1；列表展示债务、抵押、HF、清算奖励；liquidateBUSD/liquidateCOL。 |
| **Flash Loan** | `/flash-loan` | 闪电贷 | 选择 COL/BUSD、金额；显示手续费；授权 fee 后 requestFlashLoanViaReceiver。 |
| **Rate Test** | `/interest-rate-test` | 利率测试 | 拉取当前 Borrow 每 block 利率与 Supply APY；输入金额与 block 数，计算借款/存款复利后债务或价值及利息。 |
| **Analytics** | `/analytics` | 分析 | 占位/扩展。 |

### 6.3 环境变量（前端）

- `VITE_CHAIN_ID`  
- `VITE_LENDING_POOL`（PCOLBUSDPool）  
- `VITE_GOVERNANCE_TOKEN`  
- `VITE_COLLATERAL_ASSET`（COL）、`VITE_BORROW_ASSET`（BUSD）  
- `VITE_PCOL_TOKEN`、`VITE_PBUSD_TOKEN`  
- `VITE_FLASH_LOAN_RECEIVER`（FlashLoanReceiverExample）  

由 `frontend/src/utils/addresses.js` 读取。

---

## 七、部署与脚本

- **脚本**：`scripts/deploy.js`  
  - 部署 MockERC20（COL、BUSD）、GovernanceToken、PCOLBUSDPool（COL、BUSD、GovernanceToken）；池子内部创建 PCOL、PBUSD。  
  - `governanceToken.setLendingPool(pool)`。  
  - 部署 FlashLoanReceiverExample(pool)。  
  - 向池子存入 500 COL、1,000,000 BUSD 作为初始流动性；给各 signer 铸造测试用 COL/BUSD。  
  - 输出前端 .env 所需变量。  

- **运行**：`npx hardhat run scripts/deploy.js --network localhost`（需先启动本地节点）。  
- **前端**：将输出写入 `frontend/.env`，然后 `npm run dev`。

---

## 八、文档与配置

- **docs/APY说明.md**：Borrow/Supply APY 公式、拐点与单利说明。  
- **CHANGELOG.md**：按日期的修改记录。  
- **Hardhat**：`contracts/`、`scripts/` 及网络配置见项目根目录。

---

## 九、功能清单速查

| 功能 | 实现位置 |
|------|----------|
| Web3 钱包连接 | WalletContext、Header、web3.js |
| 双币种（COL + BUSD） | PCOLBUSDPool、MockERC20 |
| 存款 (Supply) | depositCOL/depositBUSD；Deposit 页 |
| 存款管理费 0.05% | depositFeeBps=5；用户获得 (amount−fee) 凭证，费留在池内 |
| 取款 (Withdraw) | withdrawCOL/withdrawBUSD；Withdraw 页 |
| 借款 (Borrow) | borrowBUSD/borrowCOL；Borrow 页（抵押/解锁） |
| 还款 (Repay) | repayBUSD/repayCOL；Repay 页 |
| 超额抵押与 LTV | 借/取抵押前 HF ≥ 1e18；**双清算阈值**：PCOL 65%、PBUSD 85% |
| 健康系数 | getHealthFactorPCOL/PBUSD；Dashboard、Borrow、Liquidate |
| 拐点利率模型 | U_opt（BUSD 85%、COL 55%）、slope1、slope2；_accrueBUSD/COL；getBorrowAPY、getSupplyAPY |
| 按 block 复利计息 | borrowIndex 每 block 增长；getCurrentDebt = scaled × index |
| Dashboard | 池内余额、Utilization、Supply/Borrow APY、GOV 余额、仓位卡片 |
| 最大可借（价格冲击+舍入安全） | getMaxBorrowBUSD/COL 二分查找+借后 HF 模拟；Borrow 页「最大」按钮 |
| 清算 | liquidateBUSD/liquidateCOL；Liquidate 页 |
| 闪电贷 | flashLoan；FlashLoanReceiverExample；Flash Loan 页 |
| 利率/利息测试 | InterestRateTest 页（债务/存款利息随 block 复利） |
| 存款/借款激励（GOV） | deposit/borrow 时 mintReward；Dashboard 显示 GOV 余额 |

以上覆盖当前仓库中与借贷、利率、清算、闪电贷、前端相关的合约与方法，便于快速理解整体运作与实现位置。
