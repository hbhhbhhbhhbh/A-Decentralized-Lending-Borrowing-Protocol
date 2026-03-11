# Supply APY 与 Borrow APY 说明

## 1. 为什么 APY 会很大？

合约里**每 block 的利率**是用 1e18 精度存的，例如：

- `baseRatePerBlockBUSD = 1e15` 表示 **每 block 利率 = 1e15/1e18 = 0.001 = 0.1%**
- 一年约 **2,102,400 个 block**（按约 15 秒一块算）

**单利年化（当前展示方式）：**

- 年化 = 每 block 利率 × 每年 block 数  
- = 0.001 × 2,102,400 ≈ **2102.4** → 前端显示成 **210240%**

所以不是公式错了，而是：**0.1% 每 block 对“每块”来说太高了**，乘上 200 多万个 block 后，年化就变成几十万%。  
真实协议里，每 block 利率通常是 1e9～1e12 量级（例如 0.0000001%～0.0001% 每 block），年化才会是几位数或几十个百分点。

---

## 2. Borrow APY（借款年化）

### 公式（合约）

- **每 block 利率（1e18 精度）：**  
  `ratePerBlock = baseRatePerBlock + multiplierPerBlock × utilization`
- **利用率：**  
  `u = totalDebt / (poolBalance + totalDebt)`  
  （借出去的是“已用掉”的，池子里剩的是“未用掉的”）
- **当前展示的 Borrow APY（单利）：**  
  `Borrow APY = ratePerBlock × BLOCKS_PER_YEAR`  
  合约返回的数值是「年化小数 × 1e18」量级，前端用 `(apyWei / 1e18) * 100` 得到百分比。

### 含义

- **Borrow APY** = 借款人每年要付的利息率（年化）。
- 债务是按 **复利** 每 block 累积的：`borrowIndex` 每 block 乘上 `(1 + ratePerBlock)`，所以实际欠款会指数增长；**展示用的 APY** 是单利折算，便于和传统年化对比。

### 和参数的关系

- `baseRatePerBlock`：利用率 0 时的每 block 利率，决定“没人借钱时的基础利率”。
- `multiplierPerBlock`：利用率每提高一点，利率多多少；利用率越高，Borrow APY 越高。

---

## 3. Supply APY（供应/存款年化）

### 公式（合约）

```text
Supply APY = Borrow APY × utilization × (1 - reserveFactor)
```

例如：`reserveFactorBpsBUSD = 1000` 表示 10% 的利息进储备金，90% 分给存款人。

### 含义

- 存款人拿到的利息 = **借款人付的利息** 里，扣掉协议留成（reserveFactor）后，**按“你的存款占池子的比例”分给你**。
- 只有被借出去的那部分资金在产生利息，所以要乘 **utilization**：
  - 没人借钱（u=0）→ Supply APY = 0
  - 有人借钱（u>0）→ Supply APY = Borrow APY × u × (1 - 10%)，一般会远小于 Borrow APY

### 和 Borrow APY 的关系

- 同一时刻：**Supply APY ≤ Borrow APY × (1 - reserveFactor)**（等号在 u=100% 时）。
- 例如 u=50%、reserve=10%：Supply APY = Borrow APY × 0.5 × 0.9 = 0.45 × Borrow APY。

---

## 4. 如何让前端 APY 显示成“正常”的百分比？

把**每 block 的利率参数调小**，让「每 block 利率 × 每年 block 数」落在 0.01～1 之间（即 1%～100% 年化），例如：

- 若希望 **0 利用率时 Borrow APY ≈ 5%**：  
  `baseRatePerBlock ≈ 0.05 / 2102400 ≈ 2.38e14`（用 1e18 精度即约 `2.38e14`）
- 若希望 **0 利用率时 Borrow APY ≈ 2%**：  
  `baseRatePerBlock ≈ 0.02 / 2102400 ≈ 9.5e12`（约 `1e13`）

合约里已把 `baseRatePerBlock` / `multiplierPerBlock` 调小到上述量级，这样前端显示的 Supply APY 和 Borrow APY 会是常见的个位数到几十个百分点，而不是几十万百分比。

---

## 5. 小结

| 项目 | 含义 |
|------|------|
| **Borrow APY** | 借款人年化利率；由每 block 利率 × 年 block 数（单利）展示。 |
| **Supply APY** | 存款人年化利率；= Borrow APY × 利用率 × (1 - 储备金率)。 |
| **APY 很大** | 因为原先每 block 利率（如 0.1%）× 200 万 block 得到几十万% 年化；已通过调小 base/multiplier 修复。 |
