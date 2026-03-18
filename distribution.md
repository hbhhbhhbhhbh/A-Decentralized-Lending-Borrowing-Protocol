# 5人功能代码分配表（文档不参与）

本分配严格按你的要求执行：
- 只分配**项目功能代码**与工程配置代码；
- 文档文件（`README.md`、`CHANGELOG.md`、`BUGS_AND_FIXES.md`、`METAMASK_AND_FLOW.md`、`docs/*`）**不参与分配**；
- 5 个人都负责代码，不允许有人只写文档；
- 每个纳入分配的文件都且只归属 1 人（不重叠）。

---

## 分配范围（本次统计的“功能代码文件”）

### 合约与接口（11）
- `contracts/PCOLBUSDPool.sol`
- `contracts/ReceiptToken.sol`
- `contracts/LendingPool.sol`
- `contracts/PriceOracle.sol`
- `contracts/FlashLoanReceiverExample.sol`
- `contracts/MockERC20.sol`
- `contracts/GovernanceToken.sol`
- `contracts/interfaces/ILendingPool.sol`
- `contracts/interfaces/IPriceOracle.sol`
- `contracts/interfaces/IAggregatorV3.sol`
- `contracts/interfaces/IFlashLoanReceiver.sol`

### 脚本与配置（6）
- `scripts/deploy.js`
- `hardhat.config.js`
- `package.json`
- `frontend/package.json`
- `frontend/.env.example`
- `TODO`

### 前端源码（23）
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/context/WalletContext.jsx`
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/Header.jsx`
- `frontend/src/components/ErrorBoundary.jsx`
- `frontend/src/components/Layout.css`
- `frontend/src/components/Header.css`
- `frontend/src/index.css`
- `frontend/src/pages/Page.css`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Deposit.jsx`
- `frontend/src/pages/Withdraw.jsx`
- `frontend/src/pages/Borrow.jsx`
- `frontend/src/pages/Repay.jsx`
- `frontend/src/pages/Liquidate.jsx`
- `frontend/src/pages/InterestRateTest.jsx`
- `frontend/src/pages/PoolTest.jsx`
- `frontend/src/pages/FlashLoan.jsx`
- `frontend/src/pages/Analytics.jsx`
- `frontend/src/utils/addresses.js`
- `frontend/src/utils/abis.js`
- `frontend/src/utils/web3.js`

合计：40 个功能代码文件。

---

## 成员 A（协议主池 + 凭证）

### 文件归属
- `contracts/PCOLBUSDPool.sol`
- `contracts/ReceiptToken.sol`
- `contracts/interfaces/IFlashLoanReceiver.sol`

### 模块职责
- 主池业务逻辑（存取、抵押、借还、清算、费率、价格）
- 凭证机制（PCOL/PBUSD）
- 与闪电贷回调接口对接

---

## 成员 B（对照协议 + 预言机）

### 文件归属
- `contracts/LendingPool.sol`
- `contracts/PriceOracle.sol`
- `contracts/interfaces/ILendingPool.sol`
- `contracts/interfaces/IPriceOracle.sol`
- `contracts/interfaces/IAggregatorV3.sol`

### 模块职责
- 备用借贷模型维护
- 价格源接口与实现维护
- 对照实验链路

---

## 成员 C（前端页面与交互）

### 文件归属
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/context/WalletContext.jsx`
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/Header.jsx`
- `frontend/src/components/ErrorBoundary.jsx`
- `frontend/src/components/Layout.css`
- `frontend/src/components/Header.css`
- `frontend/src/index.css`
- `frontend/src/pages/Page.css`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Deposit.jsx`
- `frontend/src/pages/Withdraw.jsx`
- `frontend/src/pages/Borrow.jsx`
- `frontend/src/pages/Repay.jsx`
- `frontend/src/pages/Liquidate.jsx`
- `frontend/src/pages/InterestRateTest.jsx`
- `frontend/src/pages/PoolTest.jsx`
- `frontend/src/pages/FlashLoan.jsx`
- `frontend/src/pages/Analytics.jsx`

### 模块职责
- 前端页面开发、路由、导航、钱包状态管理
- 页面交互与展示逻辑

---

## 成员 D（前端链交互层）

### 文件归属
- `frontend/src/utils/addresses.js`
- `frontend/src/utils/abis.js`
- `frontend/src/utils/web3.js`
- `contracts/FlashLoanReceiverExample.sol`

### 模块职责
- 前端合约调用封装（读写方法）
- ABI 与地址映射维护
- 闪电贷示例接收器联调

---

## 成员 E（部署与工程化）

### 文件归属
- `scripts/deploy.js`
- `hardhat.config.js`
- `package.json`
- `frontend/package.json`
- `frontend/.env.example`
- `contracts/MockERC20.sol`
- `contracts/GovernanceToken.sol`
- `TODO`

### 模块职责
- 部署脚本与运行配置
- Mock 资产与奖励代币基础设施
- 工程脚本与依赖管理

---

## 不参与分配（文档类）

以下文件不纳入 5 人功能代码分工统计：
- `README.md`
- `CHANGELOG.md`
- `BUGS_AND_FIXES.md`
- `METAMASK_AND_FLOW.md`
- `docs/APY说明.md`
- `distribution.md`

---
