# 潜在 Bug 与已做修复说明

根据全项目代码排查，以下问题已修复或需注意。

---

## 已修复

### 1. web3.js：未连接时写操作用了 Provider 而非 Signer

- **问题**：`getLendingPoolContract(true)` 和 `getERC20Contract(addr, true)` 在 `signer` 为 null 时仍传入 `provider`，导致 deposit/borrow/approve 等写操作可能失败或行为异常。
- **修复**：当 `useSigner === true` 且 `signer === null` 时直接返回 `null`，调用方会拿到“未配置”错误，提示用户先连接钱包。

### 2. 各页面用 getAccount() 导致与 Header 不同步

- **问题**：Deposit、Borrow、Repay、Withdraw、Liquidate、FlashLoan 在 mount 时各自调 `getAccount()`，和 Header 的 WalletContext 不一致；换账号后这些页面可能仍显示旧账号或“未连接”。
- **修复**：上述页面全部改为使用 `useWallet()`，与 Dashboard/Header 共用同一套“当前用户”状态。

### 3. Borrow / Withdraw / Liquidate 渲染时可能抛错

- **问题**：`healthFactor` 或 `position.collateral`/`position.debt` 若因 RPC 返回非 bigint（如异常对象），直接传给 `ethers.formatUnits` 会在渲染时抛错，导致整块内容不显示。
- **修复**：对 healthFactor、position、balance 等做类型判断与 try/catch，或使用本地 `formatWei` 安全格式化后再渲染。

### 4. chainId 为十六进制时解析错误

- **问题**：`VITE_CHAIN_ID` 若写成 `0x7a69` 等形式，`parseInt(x, 10)` 会得到错误数值。
- **修复**：在 addresses.js 中若字符串以 `0x` 开头则用 `parseInt(..., 16)`，否则用 `parseInt(..., 10)`。

### 5. Analytics 饼图语义错误

- **问题**：用 `totalCollateral - totalBorrowed` 作“Available”，但 totalCollateral 与 totalBorrowed 是两种不同代币（抵押资产 vs 借出资产），单位不同，相减无意义。
- **修复**：饼图改为两栏：“Total collateral (pool, wei)” 和 “Total borrowed (wei)”，并注明为不同资产，不再做相减。

### 6. Withdraw / Liquidate 等对 position 的空值访问

- **问题**：`position.collateral`、`targetPosition.debt` 等未做空值保护，若结构异常可能报错。
- **修复**：使用 `position?.collateral ?? 0n`、`targetPosition?.debt` 及安全 `formatWei`，避免渲染或计算时报错。

### 7. Layout 使用 Outlet 导致主内容区完全不显示

- **问题**：App 将 `<Routes>` 作为 Layout 的 `children` 传入，但 Layout 内部渲染的是 `<Outlet />` 而非 `{children}`。Outlet 仅在嵌套路由（父 Route 包子 Route）时才会渲染子路由；当前并未使用嵌套结构，因此 Outlet 没有可渲染内容，Dashboard、Borrow 等页面全部不显示，主内容区一片空白（连 “Connect MetaMask first.” 都没有）。
- **修复**：Layout 改为渲染 `{children}`（即传入的 `<Routes>`），去掉 `<Outlet />`。由 Routes 根据当前路径渲染对应页面（Dashboard、Borrow 等），主内容区恢复正常显示。同时保留 ErrorBoundary 包裹，便于后续捕获子组件抛错。

---

## 建议注意（未改逻辑）

- **Deposit/Repay 的 approve 流程**：若用户未连接，`approveToken` 会因 `getERC20Contract(..., true)` 返回 null 而抛 “Token not configured”。可考虑在 UI 层根据 `user` 禁用按钮或提示“请先连接钱包”。
- **Borrow/Withdraw 的 asset 为空**：当 `.env` 未配置 `VITE_BORROW_ASSET`/`VITE_COLLATERAL_ASSET` 时，`asset` 为空字符串，合约会 revert。已在 Borrow 的 handleSubmit 中增加 `if (!asset) return`；其他页面也可按需加同样校验。
- **大数精度**：Analytics 中 `Number(totalBorrowed)` 等在数值极大时可能丢失精度，仅影响展示，不影响合约。若需高精度可改用字符串或 BigInt 展示。

---

## 合约侧（未改）

- 合约已使用 ReentrancyGuard、SafeERC20 和 checks-effects-interactions，未发现明显漏洞；若有审计需求可再单独做安全审计。

---

## 今日改动总结（2025-03-01）

### 1. 池子与凭证：LP → PCOL / PBUSD

- **设计**：单一池内只有 COL 和 BUSD。存入 COL 获得 PCOL、存入 BUSD 获得 PBUSD（1:1 凭证）；取款时用 P 币 1:1 从池中取回对应币。P 币不加入池子，仅代表“你在池子里存了多少对应币”。
- **合约**：新增 `ReceiptToken.sol`（通用 P 币）、`PCOLBUSDPool.sol`。提供 `depositCOL`/`depositBUSD`、`withdrawCOL`/`withdrawBUSD`、抵押/借还/清算（PCOL↔BUSD、PBUSD↔COL 两套）。
- **抵押语义**：抵押 = 将 P 币转入合约锁定，**不增加**池内金额，仅代表 lock 住无法使用。解除抵押 = P 币转回用户。清算 = 清算人还债务，获得该仓位锁定的 P 币（非池内 COL/BUSD）。

### 2. 前端全面改为 PCOL/PBUSD

- **Utils**：`addresses.js`、`abis.js`、`web3.js` 改为 PCOLBUSDPool 接口（depositCOL/BUSD、withdraw、depositCollateralPCOL/PBUSD、borrowBUSD/COL、repay、liquidateBUSD/COL、getUserPositionPCOL/PBUSD 等）。`WalletContext` 中 `refreshUser` 调用 `syncSigner()`。
- **页面**：Deposit（存 COL 得 PCOL / 存 BUSD 得 PBUSD）、Withdraw（PCOL 取 COL / PBUSD 取 BUSD）、Borrow（抵押 PCOL 借 BUSD / 抵押 PBUSD 借 COL，含锁定/解锁/借入）、Repay（还 BUSD/COL）、Liquidate（清算 PCOL 仓位得 PCOL / 清算 PBUSD 仓位得 PBUSD）、Dashboard、Analytics。
- **Borrow 显示**：健康系数、清算阈值/奖励、抵押价值(USD)/债务价值(USD)、抵押物最高可借、当前 COL/BUSD 价格（池内）。PCOL 模式下锁定后不显示的问题：修复为将 `getUserPositionPCOL` 返回值统一为 `{ col, debt }` 再渲染。

### 3. Flash Loan 使用方式

- **正确流程**：用户调用 **Receiver 合约**的 `requestFlashLoan(asset, amount)`，而非直接调池子 `flashLoan`。Receiver 会先向用户收取手续费（需先对 Receiver 授权该资产），再向池子发起 flash loan 并在同一笔交易内归还本金+手续费。
- **前端**：Flash Loan 页改为调用 `requestFlashLoanViaReceiver`，并在发起前对 **Receiver** 授权手续费；文案说明“只需持有 ≥ 手续费的资产”。

### 4. 利率模型与按块计息

- **合约**：引入基于**利用率 U** 的动态利率：`ratePerBlock = baseRate + multiplier * U`（BUSD/COL 各一套）。债务用 **scaled + borrowIndex** 存储，每 block 复利更新 index；borrow/repay/liquidate 前先 `_accrueBUSD`/`_accrueCOL`。新增 `getCurrentDebtBUSD`/`getCurrentDebtCOL`、`getUtilizationBUSD`/`getUtilizationCOL`、`getBorrowAPYBUSD`/`getBorrowAPYCOL`、`getSupplyAPYBUSD`/`getSupplyAPYCOL` 等。
- **健康因子与最大可借**：统一改为使用“含利息的当前债务”`getCurrentDebt*` 计算。

### 5. Dashboard 展示

- **Pool 层**：Utilization（BUSD/COL）、Supply APY、Borrow APY。
- **用户层**：Total Collateral (USD)、Total Debt (USD)、Health Factor（PCOL→BUSD、PBUSD→COL，<1 标红 liquidatable）、钱包余额、各仓位（锁定 P 币、当前债务、Borrow APY）。

### 6. 部署与配置

- **部署脚本**：`scripts/deploy-pcolbusd.js` 部署 COL/BUSD Mock、GovernanceToken、PCOLBUSDPool、FlashLoanReceiverExample，并输出 `VITE_PCOL_TOKEN`、`VITE_PBUSD_TOKEN` 等供前端 `.env` 使用。
- **前端 .env**：需配置 `VITE_LENDING_POOL`、`VITE_PCOL_TOKEN`、`VITE_PBUSD_TOKEN`、`VITE_FLASH_LOAN_RECEIVER` 等；`.env.example` 已更新为 PCOL/PBUSD 示例。
