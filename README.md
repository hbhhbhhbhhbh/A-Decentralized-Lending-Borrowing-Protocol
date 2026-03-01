# DeFi Lending Protocol

A production-quality, Aave/Compound-style decentralized lending protocol with collateralized borrowing, liquidations, flash loans, and governance token rewards.

---

## 1. Architecture

### Overview

- **LendingPool**: Core contract. Users deposit collateral (one asset), borrow another asset, repay, withdraw. Health factor is computed from collateral value × liquidation threshold vs debt value. Positions with health factor < 1 are liquidatable; liquidators repay debt and receive collateral at a 10% bonus. Flash loans are supported with a 0.09% fee and must be repaid in the same transaction.
- **PriceOracle**: Uses Chainlink `AggregatorV3Interface` for prices. Supports a fallback price per asset (e.g. for mock tokens on local/testnet). No hardcoded prices.
- **GovernanceToken**: ERC20 with liquidity mining: the LendingPool can mint rewards to lenders/borrowers. Reward rate is configurable per second.
- **Flash loans**: Any contract implementing `IFlashLoanReceiver.executeOperation()` can receive a flash loan; the pool sends tokens, calls `executeOperation`, and reverts if the pool balance is not restored (principal + fee).
- **Security**: ReentrancyGuard on LendingPool, checks-effects-interactions, SafeERC20, Solidity 0.8 built-in overflow checks.

### Data flow

- **Deposit**: User approves collateral token → `LendingPool.deposit(collateralAsset, amount)` → user position collateral and `totalCollateral` increase.
- **Borrow**: `LendingPool.borrow(borrowAsset, amount)` → user debt and `totalBorrowed` increase; tokens sent from pool to user. Requires health factor ≥ 1.
- **Repay**: User approves borrow token → `LendingPool.repay(borrowAsset, amount)` → user debt and `totalBorrowed` decrease.
- **Withdraw**: `LendingPool.withdraw(collateralAsset, amount)` → collateral and `totalCollateral` decrease. Requires health factor ≥ 1 after withdraw.
- **Liquidate**: Liquidator calls `LendingPool.liquidate(collateralAsset, debtAsset, user)` after repaying the debt token to the pool; receives collateral with 10% bonus. Only when `getHealthFactor(user) < 1e18`.
- **Flash loan**: Caller calls `LendingPool.flashLoan(receiver, asset, amount, params)`. Pool sends `amount` to receiver, calls `receiver.executeOperation(asset, amount, fee, initiator, params)`. Receiver must transfer `amount + fee` back to the pool; otherwise the tx reverts.

### Health factor

```
healthFactor = (collateralValue * liquidationThreshold) / debtValue
```

- Stored in 18 decimals. Liquidatable when `healthFactor < 1e18`.
- Example: 80% threshold → when debt value exceeds 80% of collateral value, HF drops below 1.

### Project structure

```
project/
├── contracts/
│   ├── LendingPool.sol          # Core: deposit, withdraw, borrow, repay, liquidate, flashLoan
│   ├── PriceOracle.sol          # Chainlink + fallback prices
│   ├── GovernanceToken.sol      # ERC20 + liquidity mining
│   ├── MockERC20.sol            # Test tokens
│   ├── FlashLoanReceiverExample.sol
│   └── interfaces/
│       ├── IFlashLoanReceiver.sol
│       ├── IPriceOracle.sol
│       ├── ILendingPool.sol
│       └── IAggregatorV3.sol
├── frontend/                    # React + ethers.js + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/               # Dashboard, Deposit, Borrow, Repay, Withdraw, Liquidate, Flash Loan, Analytics
│   │   └── utils/               # abis.js, addresses.js, web3.js
│   └── package.json
├── scripts/
│   └── deploy.js                # Hardhat deploy
├── hardhat.config.js
└── README.md
```

---

## 2. Solidity contracts (summary)

Contracts are in `contracts/`. Key points:

- **LendingPool**: ReentrancyGuard, SafeERC20, `UserPosition` (collateral, debt), `getHealthFactor`, `getUtilizationRate`, `getFlashLoanFee`, `isLiquidatable`, events for Deposit/Withdraw/Borrow/Repay/Liquidate/FlashLoan.
- **PriceOracle**: `getPrice(asset)` returns 8-decimal price; `setPriceFeed(asset, feed)` for Chainlink; `setFallbackPrice(asset, price)` for mocks.
- **GovernanceToken**: ERC20 + Ownable; `setLendingPool`, `mintReward(to, amount)` (callable only by LendingPool), `setRewardRatePerSecond`, `mint` (owner).
- **IFlashLoanReceiver**: `executeOperation(asset, amount, fee, initiator, params)` returns bool.
- **MockERC20**: ERC20 with `mint(to, amount)` and `faucet(amount)` for testing.

Full code is in the repo; no pseudocode.

---

## 3. Frontend (React + ethers.js)

- **Stack**: React 18, Vite, ethers v6, react-router-dom, recharts.
- **Pages**: Dashboard (position, health factor, utilization), Deposit, Borrow, Repay, Withdraw, Liquidate (target address), Flash Loan, Analytics (utilization + simple history in localStorage, charts).
- **Features**: Connect MetaMask, display balances, collateral, debt, health factor, liquidation eligibility, approve + deposit/repay/liquidate, flash loan (with receiver address), utilization and APY-style metrics.

All interaction uses `frontend/src/utils/web3.js`: `connectWallet`, `deposit`, `withdraw`, `borrow`, `repay`, `liquidate`, `flashLoan`, `getUserPosition`, `getHealthFactor`, `getUtilizationRate`, etc. Contract addresses and chain ID come from `addresses.js` and env (`VITE_*`).

---

## 4. Deployment

### Option A: Remix IDE

1. **Compile**
   - Open [Remix](https://remix.ethereum.org).
   - Use “Solidity compiler” (e.g. 0.8.20).
   - For OpenZeppelin: use “Package Manager” (NPM) and add `@openzeppelin/contracts`, or paste contract code and adjust imports to Remix’s file explorer (e.g. flatten or use GitHub imports).

2. **Deploy order**
   - Deploy **MockERC20** twice: Collateral (e.g. “Collateral”, “COL”, 18) and Borrow (e.g. “Borrow USD”, “BUSD”, 18).
   - Deploy **PriceOracle**. Then call `setFallbackPrice(collateralAddress, 2000e8)` and `setFallbackPrice(borrowAddress, 1e8)` (8 decimals).
   - Deploy **GovernanceToken** (“Governance”, “GOV”).
   - Deploy **LendingPool**(collateralAddress, borrowAddress, oracleAddress, govTokenAddress).
   - Call **GovernanceToken.setLendingPool(lendingPoolAddress)**.
   - (Optional) Deploy **FlashLoanReceiverExample**(lendingPoolAddress).

3. **Seed liquidity**
   - Mint borrow token to yourself, then transfer a large amount to the LendingPool so users can borrow.

4. **Connect frontend**
   - Copy all deployed addresses into `frontend/.env` (see `.env.example`). Set `VITE_CHAIN_ID` to your network (e.g. 11155111 for Sepolia).
   - Run `npm install` and `npm start` in `frontend/`. Connect MetaMask to the same network.

### Option B: Hardhat (local or Sepolia)

1. Install and run local node (optional):
   ```bash
   npm install
   npx hardhat node
   ```
2. In another terminal:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```
   (For Sepolia, set `SEPOLIA_RPC_URL` and `PRIVATE_KEY` in env and use `--network sepolia`.)

3. Copy the printed addresses into `frontend/.env` (e.g. `VITE_LENDING_POOL=...`, `VITE_CHAIN_ID=31337` for local).
4. Start frontend:
   ```bash
   cd frontend && npm install && npm start
   ```
5. In MetaMask, connect to “Localhost 8545” (or Sepolia) and use the deployer account. You can mint COL/BUSD via the MockERC20 contracts or the script’s minting.

---

## 5. How to test liquidation

1. **Setup**: Deploy all contracts and seed the pool with borrow token. Give yourself collateral and borrow token (mint or transfer).
2. **Become undercollateralized**:
   - Deposit a large amount of collateral (e.g. 10 COL).
   - Borrow up to the limit so health factor is just above 1 (e.g. borrow so debt value is close to 80% of collateral value).
   - Either borrow more (if the UI allows and HF stays ≥ 1) or **lower the collateral price** in the oracle so that the same collateral value drops. For mock oracle, call `setFallbackPrice(collateralAsset, newLowerPrice)` (e.g. lower from 2000e8 to 1000e8). After that, refresh; health factor should drop below 1.
3. **Liquidate**: As another account (or same), ensure you hold enough borrow token to repay the target’s debt. Approve LendingPool to spend that token. Call `LendingPool.liquidate(collateralAsset, debtAsset, targetUser)`. The liquidator receives the target’s collateral at a 10% bonus.

---

## 6. How to test flash loan

1. **Deploy FlashLoanReceiverExample** with the LendingPool address.
2. **Fund the receiver** with the flash loan fee: the pool charges 0.09% (9 bps). So for a 1000 token loan, fee ≈ 0.9 tokens. Send that amount of the loan asset to the receiver contract (or have the receiver’s `requestFlashLoan` pull the fee from the caller after approval).
3. **Execute**: From the frontend “Flash Loan” page, set the receiver address (or call the pool directly): `LendingPool.flashLoan(receiverAddress, asset, amount, "0x")`. Or call `FlashLoanReceiverExample.requestFlashLoan(asset, amount)` after approving the receiver for the fee. The receiver gets `amount`, then repays `amount + fee` in `executeOperation`; the transaction succeeds only if the pool receives full repayment.

---

## 7. How to test oracle

1. **Fallback (no Chainlink)**: Call `PriceOracle.setFallbackPrice(asset, price)` with price in 8 decimals (e.g. `1e8` for $1, `2000e8` for $2000). Then call `getPrice(asset)` — it should return that value.
2. **Chainlink (Sepolia)**: Get the feed address for your asset from [Chainlink Sepolia Feeds](https://docs.chainlink.com/data-feeds/price-feeds/addresses?network=sepolia). Call `PriceOracle.setPriceFeed(asset, feedAddress)`. Then `getPrice(asset)` returns the feed’s latest price (8 decimals). Do not hardcode prices in the contract.

---

## 8. Example user flow

1. Connect MetaMask (local or Sepolia).
2. **Dashboard**: See 0 collateral, 0 debt, no health factor (or “—”).
3. **Deposit**: Approve collateral token for LendingPool, enter amount, Deposit. Dashboard shows collateral and collateral value.
4. **Borrow**: Enter borrow amount (e.g. BUSD), Borrow. Dashboard shows debt and health factor (e.g. 2.5). Utilization on Analytics increases.
5. **Repay**: Approve BUSD if needed, enter amount, Repay. Debt and health factor update.
6. **Withdraw**: Withdraw some collateral (health factor must stay ≥ 1).
7. **Liquidate**: To test, create an undercollateralized position (e.g. lower oracle price), then as liquidator enter the target address, approve BUSD, Liquidate. Liquidator receives collateral with 10% bonus.
8. **Flash Loan**: Set receiver address, amount, Execute. Only succeeds if receiver repays principal + fee in the same tx.
9. **Analytics**: View utilization rate and (localStorage) history/charts.

---

## Quick start (Hardhat + frontend)

```bash
# Root
npm install
npx hardhat compile
npx hardhat node   # leave running

# Second terminal
npx hardhat run scripts/deploy.js --network localhost
# Copy printed addresses to frontend/.env

# Frontend
cd frontend && npm install && npm start
# Open http://localhost:3000, connect MetaMask to Localhost 8545
```

---

## License

MIT.
"# A-Decentralized-Lending-Borrowing-Protocol" 
