# 团队提交执行手册（文件清单版）

你们按这个版本执行：**每个人 1-3 次提交，不强制一样**。  
如果某阶段确实拆不出多次，就直接 1 次提交。

## 1) 提交总规则
- 时间线固定：Stage 1 -> Stage 2 -> Stage 3 -> Stage 4 -> Stage 5。
- 每个人只提交自己阶段目录下的内容：`progressive-stages/commit-packages/stage-X-member-Y/`。
- 每次提交必须带“文件清单 + 目的”。

## 1.1) 每个人负责功能总结

- **成员1（Stage 1）- 基础搭建**
  - 负责功能：项目初始化、依赖与配置、基础部署链路、前端骨架。
  - 目标结果：项目可启动，前后端有最小可运行版本。

- **成员2（Stage 2）- 核心借贷能力**
  - 负责功能：借贷核心流程增强、预言机与约束校验、协议稳定性提升。
  - 目标结果：存取借还主流程更完整，核心风险边界更清晰。

- **成员3（Stage 3）- 架构升级与迁移**
  - 负责功能：`PCOLBUSD` 架构引入、凭证模型衔接、部署与接口迁移。
  - 目标结果：新架构替代旧流程并可正常跑通。

- **成员4（Stage 4）- 交互与测试能力**
  - 负责功能：测试页面（池子/利率）和关键业务页交互完善、前端可调试性提升。
  - 目标结果：核心流程在页面端可完整操作，测试体验更好。

- **成员5（Stage 5）- 最终收敛**
  - 负责功能：全量整合、冲突消解、参数统一、最终状态收口。
  - 目标结果：最终代码与项目当前版本一致，可作为交付版本。

## 2) 每个人怎么提交（含每次具体文件）

### 成员1（Stage 1）- 建议 2 次
源目录：`commit-packages/stage-1-member-1`

**第1次提交（工程与部署基础）**
- 文件：
  - `package.json`
  - `hardhat.config.js`
  - `scripts/deploy.js`
  - `frontend/package.json`
  - `frontend/.env.example`
- commit message：`stage1: initialize project dependencies and deployment baseline`

**第2次提交（合约+前端基础版本）**
- 文件：
  - `contracts/**`
  - `frontend/src/**`
- commit message：`stage1: add baseline contracts and frontend skeleton`

---

### 成员2（Stage 2）- 建议 3 次
源目录：`commit-packages/stage-2-member-2`

**第1次提交（核心借贷逻辑）**
- 文件：
  - `contracts/LendingPool.sol`
  - `contracts/PriceOracle.sol`
  - `contracts/interfaces/**`
- commit message：`stage2: improve core lending and oracle constraints`

**第2次提交（协议侧支撑文件）**
- 文件：
  - `contracts/MockERC20.sol`
  - `contracts/GovernanceToken.sol`
  - `contracts/FlashLoanReceiverExample.sol`
  - `scripts/deploy.js`
  - `TODO`
- commit message：`stage2: align supporting contracts and deployment scripts`

**第3次提交（前端与连接层同步）**
- 文件：
  - `frontend/src/context/WalletContext.jsx`
  - `frontend/src/utils/**`
  - `frontend/src/pages/**`
  - `frontend/src/components/**`
  - `frontend/src/App.jsx`
  - `frontend/src/main.jsx`
  - `frontend/src/index.css`
- commit message：`stage2: sync frontend integration with protocol updates`

---

### 成员3（Stage 3）- 建议 2 次
源目录：`commit-packages/stage-3-member-3`

**第1次提交（架构切换主提交）**
- 文件：
  - `contracts/PCOLBUSDPool.sol`
  - `contracts/ReceiptToken.sol`
  - `contracts/interfaces/**`
  - `scripts/deploy-pcolbusd.js`
- commit message：`stage3: introduce PCOLBUSD architecture and receipt token flow`

**第2次提交（配套迁移与前端接线）**
- 文件：
  - `contracts/LendingPool.sol`
  - `contracts/PriceOracle.sol`
  - `frontend/src/**`
  - `hardhat.config.js`
  - `package.json`
  - `frontend/package.json`
  - `frontend/.env.example`
  - `TODO`
- commit message：`stage3: migrate integrations and frontend to new pool model`

---

### 成员4（Stage 4）- 建议 1 次（可一次性）
源目录：`commit-packages/stage-4-member-4`

**第1次提交（测试能力与交互完善整包）**
- 文件：
  - `contracts/PCOLBUSDPool.sol`
  - `frontend/src/pages/InterestRateTest.jsx`
  - `frontend/src/pages/PoolTest.jsx`
  - `frontend/src/pages/Borrow.jsx`
  - `frontend/src/pages/Deposit.jsx`
  - `frontend/src/pages/Liquidate.jsx`
  - `frontend/src/components/Header.jsx`
  - `frontend/src/App.jsx`
  - `frontend/src/utils/**`
  - `scripts/deploy.js`
  - 其余 `stage-4-member-4` 下改动文件（若有）
- commit message：`stage4: complete testing pages and interaction refinements`

---

### 成员5（Stage 5）- 建议 2 次
源目录：`commit-packages/stage-5-member-5`

**第1次提交（最终合约收敛）**
- 文件：
  - `contracts/**`
- commit message：`stage5: converge all contracts to final state`

**第2次提交（前端与工程最终收敛）**
- 文件：
  - `frontend/src/**`
  - `frontend/package.json`
  - `frontend/.env.example`
  - `scripts/deploy.js`
  - `hardhat.config.js`
  - `package.json`
  - `TODO`
- commit message：`stage5: converge frontend and project configuration to final state`

## 3) 如果阶段拆不出来怎么办
- 允许 1 次提交直接完成该阶段（你说的规则）。
- 这种情况 commit message 用：
  - `stageX: complete stage X package snapshot`

## 4) 实际操作（每次提交都一样）
1. 从对应 `stage-X-member-Y` 目录拷贝本次“文件清单”到项目根目录。
2. 检查 `git status` 仅包含本次计划文件。
3. 提交一次 commit。
4. 重复下一次提交，直到该成员阶段完成。
