# 修改日志 (Changelog)

## 2026-03-01

### 新增 / 修改

#### 借贷与风控

- **最大可借考虑价格冲击（合约）**
  - `getMaxBorrowBUSD` / `getMaxBorrowCOL` 改为考虑「借款会改变池子储备进而改变价格」：
    - 借 BUSD：池内 BUSD 减少 → COL 价格下降 → 抵押价值下降，按借后价格推导最大可借 `x`，保证借满后 HF ≥ 1。
    - 借 COL：池内 COL 减少 → COL 价格上升 → 债务价值上升，同样按借后价格推导最大可借。
  - 用户按「最大可借」借满后不会因价格变动立刻变为可清算。

- **借款金额「最大」按钮（前端）**
  - Borrow 页在借款金额输入框旁增加「最大」按钮，仅在操作为 Borrow 时显示，点击后一键填入当前最大可借数量（已考虑价格冲击）。

#### 逻辑与注释

- **借款即转出池子**
  - 在 `borrowBUSD` / `borrowCOL` 的 `safeTransfer` 处增加注释，明确借出的 BUSD/COL 转给用户、离开池子。

- **价格与价值计算**
  - 为 `_priceCOLIn8`、`_priceBUSDIn8` 增加注释（池内 COL 价格 8 位小数、BUSD 固定 1 USD）。
  - 确认抵押价值、债务价值与健康因子公式一致且单位正确。

- **APY 计算说明**
  - 为 Borrow/Supply APY 相关函数增加注释：APY 为单利折算（ratePerBlock × BLOCKS_PER_YEAR），精度 1e18；Supply APY = Borrow APY × 利用率 × (1 - reserveFactor)。

#### Dashboard

- **池内余额展示**
  - Dashboard「Pool」卡片增加「池内余额」：当前池内 COL、BUSD 数量（通过 `getTokenBalance(asset, lendingPool)` 获取并展示）。

#### 文档与核对

- **需求对照检查**
  - 按作业/需求逐条核对：Web3 钱包、双币种、Deposit/Withdraw/Borrow/Repay、超额抵押与 HF、LTV、基于利用率的利率模型、按 block 计息、Dashboard 展示等均已实现并对应到代码与页面。

---

*以上为今日会话中完成的新增与修改内容。*
