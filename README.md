# DeFi Lending Project

基于以太坊的借贷协议：双币种池（COL + BUSD）、存款凭证（PCOL/PBUSD）、超额抵押借贷、按 block 复利计息、清算与闪电贷。前端通过 MetaMask 连接，提供 Dashboard、存/取/借/还、清算、闪电贷、利率测试等页面。

---

## 一、项目概览

- **主借贷池**：`PCOLBUSDPool` — 池内仅 COL 与 BUSD 两种 ERC-20；用户存入得凭证（PCOL/PBUSD），可抵押凭证借出另一种币；价格由池内储备比例决定；债务按 block 复利计息。
- **另一套实现**：`LendingPool` + `PriceOracle` — 通用抵押/借还/清算/闪电贷，价格来自 Chainlink 或 fallback，无凭证、无计息，供对比或扩展用。**当前前端与部署脚本均围绕 PCOLBUSDPool。**
- **前端**：React + Vite + ethers.js，连接 MetaMask，读写合约并展示仓位、健康系数、APY、池内余额等。

---

## 二、整体架构

```
用户 (MetaMask)
    ↓
前端 (React) ←→ 合约 (PCOLBUSDPool / LendingPool)
    ↓
ERC20: COL, BUSD | 凭证: PCOL, PBUSD | GovernanceToken
```

- **PCOLBUSDPool** 部署时创建并持有 **PCOL**、**PBUSD** 两个 ReceiptToken；池子同时持有 **GovernanceToken**，用于存款/借款奖励。
- **COL**：波动资产（测试用 MockERC20）；**BUSD**：稳定币（测试用 MockERC20，1:1 USD）。
- 价格：BUSD 固定 1e8（1 USD）；COL 价格由池内储备 `_priceCOLIn8() = (poolBUSD * 10^8 * 10^dCOL) / (poolCOL * 10^dBUSD)` 计算，8 位小数。

---

## 三、币种与凭证结构

| 名称 | 类型 | 说明 |
|------|------|------|
| **COL** | ERC20 | 波动资产，池内与 BUSD 组成储备；价格 = poolBUSD/poolCOL（8 位小数）。 |
| **BUSD** | ERC20 | 稳定币，1 USD；池内可借出或取出。 |
| **PCOL** | ReceiptToken | 池子铸造/销毁；代表“在池中存了多少 COL”；取款时 1:1 烧掉 PCOL 取回 COL。 |
| **PBUSD** | ReceiptToken | 同上，代表“在池中存了多少 BUSD”；1:1 取回 BUSD。 |
| **GovernanceToken (GOV)** | ERC20 | 治理/激励代币；池子在用户**每次存款**（depositCOL/depositBUSD）或**每次借款**（borrowBUSD/borrowCOL）时调用 `governanceToken.mintReward(user, amount)` 发放 GOV（rewardPerDeposit / rewardPerBorrow）。前端 Dashboard 的 Wallet 卡片会显示「GOV: xxx (存款/借款奖励)」。 |

- 凭证（PCOL/PBUSD）**不参与池子储备**，只代表对池子的债权；抵押时锁定的是凭证本身（转入池子合约），按池内价格折算成“抵押价值”。

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
| `baseRatePerBlock*`, `multiplierPerBlock*` | 利率模型：rate = base + multiplier × utilization（1e18）。 |
| `reserveFactorBps*` | 储备金率（bps），利息一部分留协议；Supply APY = Borrow APY × u × (1 - reserveFactor)。 |
| `liquidationThreshold` | 清算阈值（如 8000 = 80%）；HF = (抵押价值×阈值)/(债务价值×BPS)，HF < 1e18 可清算。 |
| `liquidationBonus` | 清算奖励（如 1000 = 10%），清算人获得抵押时按比例加成。 |
| `flashLoanFeeBps` | 闪电贷费率（如 9 = 0.09%）。 |
| `rewardPerDeposit`, `rewardPerBorrow` | 每次存款/借款发放的 Governance 奖励数量。 |

### 4.2 价格与储备

- **储备**：`_getReserves()` → 池子合约持有的 COL、BUSD 余额。
- **COL 价格（8 位小数）**：`_priceCOLIn8()` = (rBUSD × 10^(8+dCOL)) / (rCOL × 10^dBUSD)。
- **BUSD 价格**：`_priceBUSDIn8()` = 1e8。
- 抵押价值（8 位）：PCOL 仓位 = lockedPCOL × _priceCOLIn8()；PBUSD 仓位 = lockedPBUSD × 1e8。

### 4.3 利率模型

- **利用率**（BUSD/COL 各自）：  
  `u = totalDebt / (poolBalance + totalDebt)`（借出的币已离开池子，totalDebt 为未还债务）。
- **每 block 借款利率**（1e18）：  
  `ratePerBlock = baseRatePerBlock + multiplierPerBlock × u`。  
  BUSD 与 COL 各有一套 base/multiplier。
- **计息**：每次 borrow/repay/liquidate 前调用 `_accrueBUSD()` / `_accrueCOL()`，从 lastBlock 到当前 block，用 `(1 + rate)^n` 更新 `borrowIndex`；债务 = scaledDebt × borrowIndex / 1e18。
- **Borrow APY（展示）**：单利年化 = ratePerBlock × BLOCKS_PER_YEAR（合约返回值满足 (apyWei/1e18)×100 = 百分比）。
- **Supply APY**：Borrow APY × utilization × (1 - reserveFactorBps/BPS)。

### 4.4 核心操作与实现

#### 存款（Supply）— 增加池子流动性

| 方法 | 实现 |
|------|------|
| `depositCOL(amount)` | 用户转 COL 进池；池子 mint 等量 PCOL 给用户；可选 mintReward。 |
| `depositBUSD(amount)` | 用户转 BUSD 进池；池子 mint 等量 PBUSD 给用户；可选 mintReward。 |

#### 取款（Withdraw）— 减少池子流动性

| 方法 | 实现 |
|------|------|
| `withdrawCOL(amount)` | 用户 burn PCOL；池子转等量 COL 给用户；需池子余额足够。 |
| `withdrawBUSD(amount)` | 用户 burn PBUSD；池子转等量 BUSD 给用户。 |

#### 抵押（Collateral）— 锁定凭证才能借款

| 方法 | 实现 |
|------|------|
| `depositCollateralPCOL(amount)` | 用户将 PCOL 转给池子；`lockedPCOL[user] += amount`。 |
| `withdrawCollateralPCOL(amount)` | 池子转回 PCOL 给用户；若有 BUSD 债务需 HF ≥ 1e18。 |
| `depositCollateralPBUSD(amount)` | 锁定 PBUSD。 |
| `withdrawCollateralPBUSD(amount)` | 解锁 PBUSD；若有 COL 债务需 HF ≥ 1e18。 |

#### 借款（Borrow）— 借出的币离开池子

| 方法 | 实现 |
|------|------|
| `borrowBUSD(amount)` | 先 _accrueBUSD；要求有 PCOL 抵押、池子 BUSD 足够、借后 HF ≥ 1e18；增加 scaledDebt；**池子将 BUSD 转给用户**；可选 mintReward。 |
| `borrowCOL(amount)` | 先 _accrueCOL；要求有 PBUSD 抵押、池子 COL 足够、借后 HF ≥ 1e18；增加 scaledDebt；**池子将 COL 转给用户**；可选 mintReward。 |

#### 还款（Repay）

| 方法 | 实现 |
|------|------|
| `repayBUSD(amount)` | 先 _accrueBUSD；按当前 borrowIndex 计算债务，最多还清；减少 scaledDebt；用户转 BUSD 进池。 |
| `repayCOL(amount)` | 先 _accrueCOL；同上，还 COL 债务。 |

#### 清算（Liquidation）

| 方法 | 实现 |
|------|------|
| `liquidateBUSD(user)` | 要求 getHealthFactorPCOL(user) < 1e18；清算人代还该用户全部 BUSD 债务；用户仓位清零；清算人获得其锁定的 PCOL × (1 + liquidationBonus)；超出部分 PCOL 被 burn。 |
| `liquidateCOL(user)` | 要求 getHealthFactorPBUSD(user) < 1e18；清算人还 COL，获得用户锁定的 PBUSD（含 bonus）；超出部分 PBUSD 被 burn。 |

#### 闪电贷（Flash Loan）

| 方法 | 实现 |
|------|------|
| `flashLoan(receiver, asset, amount, params)` | asset 为 tokenCOL 或 tokenBUSD；扣 fee = amount × flashLoanFeeBps / BPS；转 amount 给 receiver；回调 `IFlashLoanReceiver(receiver).executeOperation(...)`；要求回调结束后池子余额 ≥ 借出前 + fee。 |

### 4.5 健康系数与最大可借

- **健康系数（1e18）**  
  - PCOL 借 BUSD：`HF = (collateralValuePCOL × liquidationThreshold × 1e18) / (debtBUSD × 1e8 × BPS)`  
  - PBUSD 借 COL：`HF = (collateralValuePBUSD × liquidationThreshold × 1e18) / (debtCOL × priceCOL × BPS)`  
  HF < 1e18 表示可被清算。

- **最大可借（考虑借款对价格的影响）**  
  - `getMaxBorrowBUSD(user)`：借 BUSD 会减少池子 BUSD，COL 价格下降，抵押价值下降；公式保证借到该上限后 HF 仍 ≥ 1e18（闭式解，与当前池储备、锁定、债务、阈值一致）。  
  - `getMaxBorrowCOL(user)`：借 COL 会减少池子 COL，COL 价格上升，债务价值上升；同样求借后 HF ≥ 1e18 的最大可借。

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
- 参数：`liquidationThreshold`, `liquidationBonus`；利率参数 `baseRatePerBlockBUSD/COL`, `multiplierPerBlockBUSD/COL`, `reserveFactorBpsBUSD/COL` 等（public 可读）。

---

## 五、其他合约

### 5.1 ReceiptToken

- ERC20 子类；仅 `pool` 可 `mint`/`burn`。
- 池子在 deposit 时 mint，withdraw 时 burn；1:1 对应底层资产数量。

### 5.2 GovernanceToken (GOV)

- ERC20 + Ownable；`lendingPool` 由 owner 设置后，仅该池可调 `mintReward(to, amount)`。
- **在功能中的使用**：PCOLBUSDPool 在每次 `depositCOL`/`depositBUSD` 时若 `rewardPerDeposit > 0` 则 `governanceToken.mintReward(msg.sender, rewardPerDeposit)`；在每次 `borrowBUSD`/`borrowCOL` 时若 `rewardPerBorrow > 0` 则 `mintReward(msg.sender, rewardPerBorrow)`。用户收到的 GOV 会在前端 **Dashboard → Wallet** 中显示为「GOV: xxx (存款/借款奖励)」。
- 合约内还有 `updateReward`、`rewardPerToken`、`earned` 等（本项目中池子未按时间加权计息，而是按次 mint 固定数量）。

### 5.3 LendingPool（另一套实现）

- 单抵押资产 + 单借出资产；仓位为 `positions[user].collateral` 与 `positions[user].debt`；无凭证、无复利。
- 价格来自 `IPriceOracle`；健康系数 = (collateralValue × liquidationThreshold) / (debtValue × BPS)；deposit/withdraw/borrow/repay/liquidate/flashLoan 与 PCOLBUSDPool 概念对应，但无利率与 index。
- 前端与部署脚本**未使用** LendingPool，仅作备用/参考。

### 5.4 PriceOracle

- 实现 `IPriceOracle.getPrice(asset)`（8 位小数）；可配置 Chainlink feed 或 fallback 价格；供 LendingPool 使用。

### 5.5 FlashLoanReceiverExample

- 实现 `IFlashLoanReceiver.executeOperation`：收到资产后，将 `amount + fee` 转回 `lendingPool`。
- `requestFlashLoan(asset, amount)`：调用方先向本合约授权 fee；本合约再调池子 `flashLoan(this, asset, amount, "")`。部署时传入的为 PCOLBUSDPool 地址。

### 5.6 MockERC20

- 标准 ERC20，带 `mint(to, amount)`、`faucet(amount)`，用于测试 COL/BUSD。

### 5.7 接口

- **IFlashLoanReceiver**：`executeOperation(asset, amount, fee, initiator, params)` 返回 bool。  
- **IPriceOracle**：`getPrice(asset)` 返回 uint256（8 位小数）。  
- **ILendingPool**：deposit/withdraw/borrow/repay/liquidate/flashLoan + getUserPosition、getHealthFactor、getUtilizationRate、getFlashLoanFee（与 LendingPool 一致）。  
- **IAggregatorV3**：Chainlink 价格 feed，PriceOracle 内部使用。

---

## 六、前端功能与实现

### 6.1 钱包

- **WalletContext**：提供 `user`、`refreshUser`；监听 `accountsChanged`、`chainChanged`。  
- **Header**：Connect MetaMask 按钮；未连接时各页提示先连接。  
- **web3.js**：`getProvider()`（BrowserProvider）、`connectWallet()`、`getPoolContract()`/`getPoolContractReadOnly()`、各合约读/写封装。

### 6.2 页面与功能对应

| 页面 | 路径 | 功能 | 主要实现 |
|------|------|------|----------|
| **Dashboard** | `/` | 总览 | 池内 COL/BUSD 余额、利用率、Supply/Borrow APY、用户总抵押/总债务、健康系数（PCOL→BUSD、PBUSD→COL）、钱包余额（含 **GOV 余额**，即存款/借款累计奖励）、各仓位卡片。 |
| **Deposit** | `/deposit` | 存款 | 选择 COL 或 BUSD，输入金额；approve + depositCOL/depositBUSD。 |
| **Withdraw** | `/withdraw` | 取款 | 选择 COL 或 BUSD（对应 PCOL/PBUSD），输入金额；withdrawCOL/withdrawBUSD（burn 凭证取回资产）。 |
| **Borrow** | `/borrow` | 抵押 / 解锁 / 借款 | 模式：PCOL（借 BUSD）或 PBUSD（借 COL）；操作：Lock collateral / Unlock collateral / Borrow；显示价格、清算阈值、健康系数、最大可借；**一键「最大」填入最大可借**；approve + depositCollateral* / withdrawCollateral* / borrowBUSD / borrowCOL。 |
| **Repay** | `/repay` | 还款 | 选择还 BUSD 或 COL；显示当前债务与余额；approve + repayBUSD/repayCOL。 |
| **Liquidate** | `/liquidate` | 清算 | 拉取曾抵押过的用户，过滤 HF < 1 的仓位；列表展示债务、抵押、HF、清算奖励；清算人 approve 后调用 liquidateBUSD/liquidateCOL。 |
| **Flash Loan** | `/flash-loan` | 闪电贷 | 选择 COL/BUSD、输入金额；显示手续费；用户向 FlashLoanReceiverExample 授权手续费后，调用 requestFlashLoanViaReceiver。 |
| **Rate Test** | `/interest-rate-test` | 利率测试 | 拉取当前 Borrow 每 block 利率与 Supply APY；输入借款/存款金额与 block 数，计算复利后债务或存款价值及利息。 |
| **Analytics** | `/analytics` | 分析 | 占位/扩展用。 |

### 6.3 环境变量（前端）

- `VITE_CHAIN_ID`  
- `VITE_LENDING_POOL`（PCOLBUSDPool 地址）  
- `VITE_GOVERNANCE_TOKEN`  
- `VITE_COLLATERAL_ASSET`（COL）  
- `VITE_BORROW_ASSET`（BUSD）  
- `VITE_PCOL_TOKEN`, `VITE_PBUSD_TOKEN`  
- `VITE_FLASH_LOAN_RECEIVER`（FlashLoanReceiverExample 地址）  

由 `frontend/src/utils/addresses.js` 读取。

---

## 七、部署与脚本

- **脚本**：`scripts/deploy.js`  
  - 部署 MockERC20（COL、BUSD）、GovernanceToken、PCOLBUSDPool（传入 COL、BUSD、GovernanceToken）；池子内部创建 PCOL、PBUSD。  
  - 调用 `governanceToken.setLendingPool(pool)`。  
  - 部署 FlashLoanReceiverExample(pool)。  
  - 给 deployer 铸造 COL/BUSD 并向池子存入 500 COL、1,000,000 BUSD 作为初始流动性；给所有 signer 铸造测试用 COL/BUSD。  
  - 输出前端所需 .env 变量。  

- **运行**（示例）：`npx hardhat run scripts/deploy.js --network localhost`（需先启动本地节点）。  

- **前端**：将输出的环境变量写入 `frontend/.env`，然后 `npm run dev`。

---

## 八、文档与配置

- **docs/APY说明.md**：Borrow/Supply APY 公式、为何 APY 会很大、参数含义、单利与复利说明。  
- **CHANGELOG.md**：按日期的修改记录（最大可借考虑价格冲击、最大按钮、池内余额、利率参数与注释等）。  
- **Hardhat**：`contracts/`、`scripts/`、测试与网络配置见项目根目录 hardhat 配置。

---

## 九、功能清单速查

| 功能 | 实现位置 |
|------|----------|
| Web3 钱包连接 | 前端 WalletContext、Header、web3.js |
| 双币种（COL + BUSD） | PCOLBUSDPool、MockERC20 |
| 存款 (Supply) | depositCOL / depositBUSD、Deposit 页 |
| 取款 (Withdraw) | withdrawCOL / withdrawBUSD、Withdraw 页 |
| 借款 (Borrow) | borrowBUSD / borrowCOL、Borrow 页（含抵押/解锁） |
| 还款 (Repay) | repayBUSD / repayCOL、Repay 页 |
| 超额抵押与 LTV | 借/取抵押前检查 HF ≥ 1e18；liquidationThreshold 等效最大 LTV |
| 健康系数实时计算与展示 | getHealthFactorPCOL/PBUSD；Dashboard、Borrow、Liquidate |
| 动态利率（利用率） | baseRate + multiplier×u；_accrueBUSD/COL；getBorrowAPY、getSupplyAPY |
| 按 block 复利计息 | borrowIndex 每 block 增长；getCurrentDebt = scaled × index |
| Dashboard（抵押/债务/APY/HF） | Dashboard 页 + 池内余额、Utilization、Supply/Borrow APY |
| 最大可借（含价格冲击） | getMaxBorrowBUSD、getMaxBorrowCOL；Borrow 页「最大」按钮 |
| 清算 | liquidateBUSD、liquidateCOL；Liquidate 页 |
| 闪电贷 | flashLoan；FlashLoanReceiverExample；Flash Loan 页 |
| 利率/利息测试 | InterestRateTest 页（债务与存款利息随 block 复利） |
| 存款/借款激励（GOV） | 合约：deposit/borrow 时 governanceToken.mintReward；rewardPerDeposit、rewardPerBorrow。前端：Dashboard Wallet 显示 GOV 余额。 |

以上覆盖本仓库中与借贷、利率、清算、闪电贷、前端相关的合约与方法，便于从未接触项目的人快速理解整体运作与实现位置。
