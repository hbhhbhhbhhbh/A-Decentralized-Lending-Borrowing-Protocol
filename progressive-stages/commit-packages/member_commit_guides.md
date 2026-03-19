# Member Commit Guides (What to Explain in Each Commit)

这份文件可以直接发给队友照着提交。  
每位成员都给了：
- 负责功能说明（讲解角度）
- 建议拆分的 commit 次序
- 每次 commit message 模板（中英都可）

---

## Member 1 (Stage 1: Base Demo)

## 负责功能（讲解）
- 搭建项目可运行骨架：合约可部署、前端可启动、钱包可连接。
- 完成最小业务闭环：Deposit / Withdraw + Dashboard 基础展示。
- 完成基础合约与前端交互打通（ABI、web3 调用、地址配置）。

## 建议 commit 拆分
1. **Scaffold & config**
   - `hardhat.config.js`, `package.json`, `frontend/package.json`, `.env.example`
2. **Core contracts bootstrap**
   - `MockERC20`, `ReceiptToken`, `GovernanceToken`, `PCOLBUSDPool`(基础版)
3. **Frontend skeleton**
   - `main`, `App`, `Layout`, `Header`, `WalletContext`, 公共样式
4. **Deposit/Withdraw flow**
   - `Deposit`, `Withdraw`, `utils/*`
5. **Dashboard base**
   - 基础池子与钱包信息展示

## 推荐 commit message
- `feat(stage1): initialize hardhat + vite project scaffolding`
- `feat(stage1): add base pool and token contracts`
- `feat(stage1): implement wallet connection and app layout`
- `feat(stage1): implement deposit/withdraw user flow`
- `feat(stage1): add dashboard base metrics`

---

## Member 2 (Stage 2: Collateral / Borrow / Repay)

## 负责功能（讲解）
- 从“存取款 Demo”升级到“可借贷协议”：加入抵押锁定、借款、还款主流程。
- 保证授权、余额校验、借款上限与前端交互闭环。

## 建议 commit 拆分
1. **Contract borrowing primitives**
   - `PCOLBUSDPool` 加入 collateral/borrow/repay 核心路径
2. **Web3 API extension**
   - `utils/abis.js`, `utils/web3.js` 新增 borrow/repay/collateral 接口
3. **Borrow UI**
   - `Borrow.jsx`（锁定/解锁/借款）
4. **Repay UI**
   - `Repay.jsx`
5. **Routing integration**
   - `App.jsx`, `Header.jsx` 增加导航与路由

## 推荐 commit message
- `feat(stage2): add collateral lock/unlock and borrowing logic`
- `feat(stage2): extend frontend web3 wrappers for borrow/repay`
- `feat(stage2): add borrow page with collateral actions`
- `feat(stage2): add repay page and debt repayment flow`
- `chore(stage2): wire routes and navigation for borrow/repay`

---

## Member 3 (Stage 3: Risk Engine / Interest Model)

## 负责功能（讲解）
- 完成协议“风控和计息内核”：健康因子、利用率、借贷 APY、按 block 复利。
- 加入最大可借（max borrow）与风险展示，防止借后立刻可清算。

## 建议 commit 拆分
1. **Interest accrual core**
   - `borrowIndex`, `scaledDebt`, `accrue` 相关逻辑
2. **Kink rate model**
   - base/slope/U_opt, utilization, APY 读取接口
3. **Risk functions**
   - `HF`, `isLiquidatable`, `getMaxBorrow*`
4. **Frontend risk display**
   - `Dashboard.jsx`、`Borrow.jsx` 增强
5. **Rate test page**
   - `InterestRateTest.jsx`

## 推荐 commit message
- `feat(stage3): implement block-based debt accrual with borrow indices`
- `feat(stage3): add kinked interest rate and APY view functions`
- `feat(stage3): implement health factor and max borrow calculations`
- `feat(stage3): expose risk metrics in dashboard and borrow page`
- `feat(stage3): add interest rate simulation page`

---

## Member 4 (Stage 4: Liquidation + Stress Testing)

## 负责功能（讲解）
- 增加清算机制的完整链路（合约 + 前端执行 + 余额与授权处理）。
- 增加池储备测试能力，用于构造价格波动和清算场景。

## 建议 commit 拆分
1. **Liquidation contract path**
   - `liquidateBUSD/liquidateCOL` 与相关事件/校验
2. **Liquidation frontend**
   - `Liquidate.jsx` 列表筛选 + 按钮执行
3. **Pool test contract helpers**
   - `inject` / fee or reserve related helpers（若阶段需要）
4. **Pool stress UI**
   - `PoolTest.jsx`
5. **Route/nav integration**
   - `App.jsx`, `Header.jsx`

## 推荐 commit message
- `feat(stage4): add liquidation execution paths in pool contract`
- `feat(stage4): implement liquidation page with repay-asset checks`
- `feat(stage4): add reserve adjustment helpers for testing`
- `feat(stage4): add pool stress testing page for liquidation scenarios`
- `chore(stage4): register routes and nav entries for new pages`

---

## Member 5 (Stage 5: Fee Curve + Final Product Polish)

## 负责功能（讲解）
- 完成管理费策略升级（按价格影响的次线性曲线）。
- 前端展示“预计管理费 + 费率”。
- UI 统一英文文案，并做最后路由/产品化整理。

## 建议 commit 拆分
1. **Fee model in contract**
   - `impact^0.25`、fee 视图函数、参数变量
2. **Frontend fee API**
   - `utils/abis.js`, `utils/web3.js` 增加 fee 查询
3. **Deposit fee UI**
   - `Deposit.jsx` 显示 fee amount + fee rate
4. **Global copy polish**
   - 多页面中文转英文
5. **Final route polish**
   - 下线/隐藏非当前重点入口（如 FlashLoan/Analytics 导航）

## 推荐 commit message
- `feat(stage5): upgrade deposit fee to sublinear price-impact model`
- `feat(stage5): expose and consume estimated deposit fee APIs`
- `feat(stage5): show estimated fee amount and rate on deposit page`
- `chore(stage5): translate UI copy to english across pages`
- `chore(stage5): finalize route and navigation polish`

---

## 通用提交说明模板（给每个人）

可以在 PR 描述里统一写：

```text
## Scope
- Stage: <stage-x>
- Owner: <member-x>

## What I implemented
- <核心功能点1>
- <核心功能点2>

## Why
- <这个改动解决了什么问题/补齐了什么能力>

## Verification
- <本地如何验证：页面/命令/预期结果>
```

这样最后评审时，老师或组长能非常快看到每个人“做了什么”和“为什么这么做”。

