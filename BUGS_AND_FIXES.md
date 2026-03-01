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

---

## 建议注意（未改逻辑）

- **Deposit/Repay 的 approve 流程**：若用户未连接，`approveToken` 会因 `getERC20Contract(..., true)` 返回 null 而抛 “Token not configured”。可考虑在 UI 层根据 `user` 禁用按钮或提示“请先连接钱包”。
- **Borrow/Withdraw 的 asset 为空**：当 `.env` 未配置 `VITE_BORROW_ASSET`/`VITE_COLLATERAL_ASSET` 时，`asset` 为空字符串，合约会 revert。已在 Borrow 的 handleSubmit 中增加 `if (!asset) return`；其他页面也可按需加同样校验。
- **大数精度**：Analytics 中 `Number(totalBorrowed)` 等在数值极大时可能丢失精度，仅影响展示，不影响合约。若需高精度可改用字符串或 BigInt 展示。

---

## 合约侧（未改）

- 合约已使用 ReentrancyGuard、SafeERC20 和 checks-effects-interactions，未发现明显漏洞；若有审计需求可再单独做安全审计。
