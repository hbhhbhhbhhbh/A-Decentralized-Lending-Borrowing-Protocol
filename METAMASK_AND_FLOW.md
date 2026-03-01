# 完整流程：从零到用 MetaMask 与协议交互

本文档说明**从零开始**的完整流程，包括如何配置 MetaMask、部署合约、启动前端，以及如何用 MetaMask 连接并操作。不包含任何预先的功能测试。

---

## 前置条件

- 已安装 **Node.js**（建议 v18+）
- 浏览器已安装 **MetaMask** 插件
- 项目已安装依赖：在项目根目录执行过 `npm install`

---

## 第一步：启动本地区块链（Hardhat 节点）

1. 打开**第一个终端**，进入项目根目录：
   ```bash
   cd d:\poly\DeFi\Project
   ```
2. 启动本地链（会一直运行，不要关闭）：
   ```bash
   npx hardhat node
   ```
3. 终端里会输出一列**账户地址**和对应的 **Private Key**。**先不要关这个窗口**，后面配置 MetaMask 会用到其中一个私钥。

---

## 第二步：配置 MetaMask 连接本地网络

1. 打开浏览器，点击 MetaMask 图标打开插件。
2. 点击顶部网络下拉框（显示“Ethereum 主网”或其它网络），选择 **“添加网络”** 或 **“添加自定义网络”**。
3. 选择 **“手动添加网络”**（或 “Add a network manually”），填写：

   | 字段 | 填写内容 |
   |------|----------|
   | **网络名称** | `Hardhat Local`（或任意名称） |
   | **RPC URL** | `http://127.0.0.1:8545` |
   | **Chain ID** | `31337` |
   | **货币符号** | `ETH`（可选） |

4. 点击**保存**。保存后 MetaMask 会切换到该网络。

---

## 第三步：把 Hardhat 测试账户导入 MetaMask

本地节点启动时打印了多个账户，你需要用**其中一个**来和前端交互（通常用第一个，即部署合约的账户）。

1. 回到运行 `npx hardhat node` 的终端，找到类似这样的输出：
   ```
   Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
   Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2f80
   ```
2. **复制 Account #0 的 Private Key**（上面那一长串 0x 开头的字符串）。
3. 在 MetaMask 中：
   - 点击右上角头像 → **“导入账户”**（Import account）；
   - 选择 **“私钥”**；
   - 粘贴刚才复制的私钥；
   - 确认导入。
4. 导入后，该账户会出现在 MetaMask 里，并且会显示 10000 ETH（本地测试币）。**之后前端操作都用这个账户**。

---

## 第四步：部署智能合约

1. 打开**第二个终端**（保持第一个终端里的 `npx hardhat node` 继续运行）。
2. 进入项目根目录并执行部署脚本：
   ```bash
   cd d:\poly\DeFi\Project
   npx hardhat run scripts/deploy.js --network localhost
   ```
3. 部署成功后，终端会打印一列合约地址，例如：
   ```text
   Collateral token (COL): 0x5FbDB...
   Borrow token (BUSD): 0xe7f17...
   PriceOracle: 0x9fE46...
   GovernanceToken: 0x5FC8d...
   LendingPool: 0x01658...
   FlashLoanReceiverExample: 0x2279B...
   --- Summary ---
   VITE_LENDING_POOL=0x0165878A594ca255338adfa4d48449f69242Eb8F
   VITE_PRICE_ORACLE=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
   ...
   ```
4. **把 “Summary” 下面那几行完整复制下来**，准备填到前端的 `.env` 里。

---

## 第五步：配置前端环境变量

1. 在项目里找到 `frontend` 文件夹，进入 `frontend` 目录。
2. 若没有 `.env` 文件，可复制示例再改：
   ```bash
   cd d:\poly\DeFi\Project\frontend
   copy .env.example .env
   ```
   （Linux/Mac 用 `cp .env.example .env`）
3. 用记事本或 VS Code 打开 `frontend\.env`，把第四步复制的 Summary 内容**按行粘贴进去**，确保变量名和值一一对应，例如：
   ```env
   VITE_CHAIN_ID=31337
   VITE_LENDING_POOL=0x0165878A594ca255338adfa4d48449f69242Eb8F
   VITE_PRICE_ORACLE=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
   VITE_GOVERNANCE_TOKEN=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
   VITE_COLLATERAL_ASSET=0x5FbDB2315678afecb367f032d93F642f64180aa3
   VITE_BORROW_ASSET=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   VITE_FLASH_LOAN_RECEIVER=0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
   ```
4. 保存并关闭 `.env`。**注意**：若你部署后打印的地址和上面不同，必须以你本机部署脚本输出的地址为准。

---

## 第六步：安装并启动前端

1. 在**第二个终端**（或新开一个终端），进入前端目录并安装依赖（若之前没装过）：
   ```bash
   cd d:\poly\DeFi\Project\frontend
   npm install
   ```
2. 启动前端：
   ```bash
   npm start
   ```
3. 浏览器会自动打开 `http://localhost:3000`（或按终端提示的地址打开）。此时页面上还**没有**连接钱包。

---

## 第七步：用 MetaMask 连接前端

1. 确认 MetaMask 当前网络是 **Hardhat Local**（或你添加的本地网络，Chain ID 31337）。
2. 在打开的 DeFi 前端页面，点击右上角 **“Connect MetaMask”** 按钮。
3. MetaMask 会弹出授权窗口，选择你导入的 Hardhat 账户（Account #0），点击 **“下一步”** → **“连接”**。
4. 连接成功后，页面右上角会显示缩短后的地址（如 `0xf39F...2266`），表示已用 MetaMask 与该前端连接，可以进行交互。

---

## 第八步：与协议交互的推荐顺序

按下面顺序操作，可以完整走通存抵押、借款、还款、取回抵押等流程（不做任何预先测试，仅按协议设计使用）：

1. **Dashboard**  
   查看当前抵押、债务、健康因子（初始为 0 / 空）。

2. **Deposit（存入抵押）**  
   - 部署脚本已给当前账户铸造了抵押代币（COL）。  
   - 打开 **Deposit** 页，输入要存入的数量，点击 **Deposit**。  
   - 第一次会先弹出 **Approve** 交易，在 MetaMask 里确认；再发 **Deposit** 交易，再确认。  
   - 完成后在 Dashboard 可看到抵押余额和抵押价值。

3. **Borrow（借款）**  
   - 打开 **Borrow** 页，输入要借的 BUSD 数量，点击 **Borrow**。  
   - 在 MetaMask 确认交易。  
   - 成功后 Dashboard 会显示债务和健康因子。

4. **Repay（还款）**  
   - 打开 **Repay** 页，输入要还的 BUSD 数量（可点 Max），先 **Approve** 再 **Repay**，在 MetaMask 分别确认。

5. **Withdraw（取回抵押）**  
   - 在健康因子 ≥ 1 的前提下，打开 **Withdraw**，输入数量并确认交易，可取回部分或全部抵押。

6. **Analytics**  
   - 查看利用率等统计（数据来自当前链上状态，无预先测试数据）。

7. **Liquidate / Flash Loan**  
   - 需要满足协议条件（如健康因子 < 1 才能被清算；闪电贷需有接收合约并支付手续费），按页面提示操作即可。

---

## 常见问题

- **前端显示 “Switch to Local/Sepolia”**  
  说明当前 MetaMask 网络不是本地（31337）或 Sepolia，请切回 **Hardhat Local**。

- **交易一直转圈或失败**  
  确认第一个终端里 `npx hardhat node` 仍在运行；确认 MetaMask 用的是导入的 Hardhat 账户且网络为 31337。

- **刷新页面后要重新连接**  
  再次点击 **Connect MetaMask** 即可；账户和网络不变则无需重新导入。

- **重新部署合约后**  
  需要把部署脚本再次输出的地址更新到 `frontend\.env`，并**重启前端**（停止 `npm start` 后重新执行 `npm start`），否则前端仍会连到旧合约。

---

## 流程小结

| 步骤 | 做什么 |
|-----|--------|
| 1 | 终端1：`npx hardhat node`（保持运行） |
| 2 | MetaMask：添加网络 RPC `http://127.0.0.1:8545`，Chain ID `31337` |
| 3 | MetaMask：导入 Hardhat 账户私钥（Account #0） |
| 4 | 终端2：`npx hardhat run scripts/deploy.js --network localhost`，复制打印的地址 |
| 5 | 在 `frontend\.env` 里填入这些地址并保存 |
| 6 | `cd frontend` → `npm install` → `npm start`，打开浏览器 |
| 7 | 前端点击 “Connect MetaMask”，在 MetaMask 中同意连接 |
| 8 | 按 Deposit → Borrow → Repay → Withdraw 等顺序在页面上操作，用 MetaMask 确认每笔交易 |

按上述流程做完，即完成从零到用 MetaMask 与协议交互的整个配置与使用过程，且不依赖任何预先的功能测试。
