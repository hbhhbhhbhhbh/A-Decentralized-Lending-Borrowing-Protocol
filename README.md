# DeFi Lending Project (COL/BUSD, PCOL/PBUSD)

这是一个完整的 DeFi 借贷示例项目，核心是单池双资产模型：池内只持有 `COL` 与 `BUSD`，用户存款会得到凭证 `PCOL/PBUSD`，抵押凭证后可借另一种资产。

本 README 目标是：让任何新接手的人能快速看懂
- 功能有哪些；
- 每个功能怎么实现；
- 每个关键文件在做什么。

---

## 1) 当前项目状态

### 当前主线
- 主合约：`contracts/PCOLBUSDPool.sol`
- 主前端：`frontend/src/`
- 主部署脚本：`scripts/deploy.js`

### 当前前端已开放路由
- `/` Dashboard
- `/deposit` Deposit
- `/borrow` Borrow
- `/repay` Repay
- `/withdraw` Withdraw
- `/liquidate` Liquidate
- `/interest-rate-test` 利率测试
- `/pool-test` 池储备测试

### 当前前端已下线入口（文件保留）
- `frontend/src/pages/FlashLoan.jsx`
- `frontend/src/pages/Analytics.jsx`

这两个页面文件仍在仓库中，但已从 `frontend/src/App.jsx` 路由和 `frontend/src/components/Header.jsx` 导航移除。

---

## 2) 协议核心机制

## 2.1 资产与凭证
- `COL`：波动资产（测试中通常为 `MockERC20`）
- `BUSD`：稳定资产（按 1 USD 处理）
- `PCOL`：存 COL 的凭证
- `PBUSD`：存 BUSD 的凭证

规则：
- 存 COL -> 得 PCOL；存 BUSD -> 得 PBUSD
- 取款时销毁凭证，1:1 取回底层资产
- 抵押的是 PCOL/PBUSD，不是直接抵押 COL/BUSD

## 2.2 定价
- BUSD 固定价格：`1e8`（8 位小数）
- COL 价格来自池内储备：
  - `priceCOL = poolBUSD / poolCOL`（按 decimals 与 1e8 缩放）

因此，池内 COL/BUSD 储备变化会直接改变 COL 价格，继而影响健康因子与可清算性。

## 2.3 借贷方向
- 仓位 A：抵押 `PCOL`，借 `BUSD`
- 仓位 B：抵押 `PBUSD`，借 `COL`

## 2.4 健康因子与清算
- `HF < 1e18` 可清算
- 清算阈值：
  - `liquidationThresholdPCOL = 6500`（65%）
  - `liquidationThresholdPBUSD = 8500`（85%）

清算资产匹配规则（已在合约与前端体现）：
- 清算 `PCOL->BUSD` 仓位时，清算者必须用 `BUSD` 偿还债务
- 清算 `PBUSD->COL` 仓位时，清算者必须用 `COL` 偿还债务

## 2.5 利率与计息
- 使用拐点利率模型（Kinked）：
  - `u <= U_opt`：`base + slope1*u`
  - `u > U_opt`：`rateAtOpt + slope2*(u-U_opt)`
- 债务按 block 复利：`scaledDebt * borrowIndex / 1e18`
- 合约提供：
  - `getBorrowRatePerBlock*`
  - `getBorrowAPY*`
  - `getSupplyAPY*`
  - `getUtilization*`

## 2.6 存款管理费（当前实现）
- 首笔存入（池内该资产为 0）走固定费率：`depositFeeBps`
- 其余情况走“按价格影响”的次线性收费：
  - `impact = amount / (poolReserve + amount)`
  - `fee = amount * impact^0.25 * impactFeeMultiplierBps / BPS`

当前变量（以代码值为准）：
- `depositFeeBps = 5`（0.05%）
- `impactFeeMultiplierBps = 10`

> 备注：该变量附近有历史注释文本与当前值不完全一致，真实行为以变量值为准。

## 2.7 池储备测试能力
- 合约有 `injectCOL/injectBUSD`（转入池子，不铸造凭证）
- 前端 `PoolTest` 页面额外支持 `mintTokenTo(token, pool, amount)`（直接把 Mock 代币 mint 到池子地址，便于快速构造价格冲击）

---

## 3) 功能 -> 实现位置速查

| 功能 | 合约 | 前端 |
|---|---|---|
| 存款 | `depositCOL/depositBUSD` | `pages/Deposit.jsx` |
| 预计管理费 | `getDepositFeeCOL/getDepositFeeBUSD` | `pages/Deposit.jsx`（金额+费率） |
| 取款 | `withdrawCOL/withdrawBUSD` | `pages/Withdraw.jsx` |
| 抵押锁定/解锁 | `depositCollateral*/withdrawCollateral*` | `pages/Borrow.jsx` |
| 借款 | `borrowBUSD/borrowCOL` | `pages/Borrow.jsx` |
| 最大可借 | `getMaxBorrowBUSD/getMaxBorrowCOL` | `pages/Borrow.jsx`“最大” |
| 还款 | `repayBUSD/repayCOL` | `pages/Repay.jsx` |
| 清算 | `liquidateBUSD/liquidateCOL` | `pages/Liquidate.jsx` |
| 利率/APY | `getBorrowRate* / getBorrowAPY* / getSupplyAPY*` | `pages/Dashboard.jsx`, `pages/InterestRateTest.jsx` |
| 调池测试 | `inject*` + 价格函数 | `pages/PoolTest.jsx`（当前使用 mint 到池） |
| 闪电贷 | `flashLoan` | `pages/FlashLoan.jsx`（入口下线） |

---

## 4) 目录结构与每个文件做什么

仅列核心源码/文档文件；`artifacts`、`cache`、`dist`、`node_modules` 为构建产物或依赖，不逐个说明。

## 4.1 根目录

- `package.json`
  - 根脚本与依赖（Hardhat、OpenZeppelin）
- `hardhat.config.js`
  - Solidity 编译与网络配置（hardhat + sepolia）
- `scripts/deploy.js`
  - 一键部署 Mock 资产、GOV、PCOLBUSDPool、FlashLoanReceiver，并输出前端 `.env` 配置
- `README.md`
  - 项目总说明（本文件）
- `CHANGELOG.md`
  - 历史改动记录
- `BUGS_AND_FIXES.md`
  - 问题与修复记录
- `METAMASK_AND_FLOW.md`
  - 从零部署 + MetaMask 接入操作流程
- `docs/APY说明.md`
  - APY 计算口径说明

## 4.2 合约 `contracts/`

### 主线合约
- `contracts/PCOLBUSDPool.sol`
  - 主协议：存取、抵押、借还、清算、闪电贷、管理费、最大可借、价格与APY读取
- `contracts/ReceiptToken.sol`
  - 凭证代币 PCOL/PBUSD，仅池子可 mint/burn
- `contracts/GovernanceToken.sol`
  - 治理/激励代币，池子可 mintReward
- `contracts/MockERC20.sol`
  - 测试代币，支持 `mint`/`faucet`
- `contracts/FlashLoanReceiverExample.sol`
  - 闪电贷接收器示例

### 备用/对照
- `contracts/LendingPool.sol`
  - 另一套通用借贷模型（非当前前端主线）
- `contracts/PriceOracle.sol`
  - Chainlink + fallback 价格源（主要服务上面这套通用模型）

### 接口
- `contracts/interfaces/IFlashLoanReceiver.sol`
- `contracts/interfaces/ILendingPool.sol`
- `contracts/interfaces/IPriceOracle.sol`
- `contracts/interfaces/IAggregatorV3.sol`

## 4.3 前端 `frontend/src/`

### 入口与框架
- `main.jsx`
  - React 入口，挂载 Router + WalletProvider
- `App.jsx`
  - 路由定义（当前不含 flash-loan / analytics）
- `components/Layout.jsx`
  - 页面布局与 ErrorBoundary 包裹
- `components/Header.jsx`
  - 顶部导航与 Connect MetaMask
- `components/ErrorBoundary.jsx`
  - 运行时错误边界

### 钱包与链交互
- `context/WalletContext.jsx`
  - 钱包地址状态、账户切换/链切换监听
- `utils/addresses.js`
  - 从 `.env` 读取地址
- `utils/abis.js`
  - ABI 定义
- `utils/web3.js`
  - 所有合约读写封装（approve、deposit、borrow、liquidate、APY/价格读取、测试 mint 等）

### 页面
- `pages/Dashboard.jsx`
  - 池子总览 + 用户仓位总览 + HF + APY + 余额
- `pages/Deposit.jsx`
  - 存款、授权、实时展示预计管理费与管理费率
- `pages/Withdraw.jsx`
  - 用凭证提取底层资产（仅未锁定凭证可提取）
- `pages/Borrow.jsx`
  - 抵押锁定/解锁 + 借款 + 最大可借 + HF
- `pages/Repay.jsx`
  - BUSD/COL 两类债务还款
- `pages/Liquidate.jsx`
  - 可清算仓位列表、余额校验、执行清算
- `pages/InterestRateTest.jsx`
  - 按当前链上利率模拟 N blocks 后债务/存款变化
- `pages/PoolTest.jsx`
  - 调池测试页（直接增池内资产，观察价格和清算变化）

### 目前未挂载页面（仍有实现）
- `pages/FlashLoan.jsx`
- `pages/Analytics.jsx`

### 样式
- `index.css`
- `pages/Page.css`
- `components/Header.css`
- `components/Layout.css`

---

## 5) 环境变量

前端读取 `frontend/.env`：

```env
VITE_CHAIN_ID=31337
VITE_LENDING_POOL=
VITE_GOVERNANCE_TOKEN=
VITE_COLLATERAL_ASSET=
VITE_BORROW_ASSET=
VITE_PCOL_TOKEN=
VITE_PBUSD_TOKEN=
VITE_FLASH_LOAN_RECEIVER=
```

---

## 6) 本地运行

## 6.1 安装依赖

根目录：
```bash
npm install
```

前端：
```bash
cd frontend
npm install
```

## 6.2 启动本地链

```bash
npx hardhat node
```

## 6.3 部署

```bash
npx hardhat run scripts/deploy.js --network localhost
```

把输出的 `VITE_*` 地址填入 `frontend/.env`。

## 6.4 启动前端

```bash
cd frontend
npm run dev
```

浏览器打开 Vite 地址后，连接 MetaMask（`chainId = 31337`）。

---

## 7) 设计上为什么这样做

- 凭证化存款（PCOL/PBUSD）：把“资产存入池”和“资产锁定抵押”拆开，状态更清晰。
- 双向借贷（PCOL->BUSD, PBUSD->COL）：能覆盖更真实的跨资产风险管理。
- 最大可借二分：避免借后因价格联动立刻爆仓。
- 管理费按价格影响：对“更能扰动价格的存款行为”收更高代价。
- PoolTest 页面：方便稳定复现清算场景。

---

## 8) 已知注意事项

- `FlashLoan` 与 `Analytics` 前端入口已下线，但功能文件保留。
- `PCOLBUSDPool` 中管理费倍率注释与变量值存在历史不一致，行为以变量值为准。
- 部署脚本文案中个别注释/打印可能有历史残留，实际以链上数据为准。

---

## 9) 维护建议

- 如果你要恢复闪电贷或 analytics 页面：
  1) 在 `frontend/src/App.jsx` 恢复路由；
  2) 在 `frontend/src/components/Header.jsx` 恢复导航项。
- 如果你要线上可调参数，建议给 `PCOLBUSDPool` 增加 owner/governance setter（利率、阈值、费率曲线参数等）。
- 如果你要做可观测性，建议在前端追加“协议参数面板”，统一展示链上关键参数。

