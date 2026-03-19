# Stage 3 - PCOLBUSD Transition

This stage is based on historical commit `d14147a`, where the project transitions toward the `PCOLBUSDPool` model.

## Goal
- Introduce and validate the main dual-asset pool direction (COL/BUSD with receipt tokens).

## What Is Included
- `PCOLBUSDPool` introduced with core deposit/borrow/repay/liquidation structure.
- `ReceiptToken` integration and related supporting contract updates.
- Frontend wiring updated to interact with the new pool architecture.

## Delta vs Stage 2
- Architecture shifts from earlier generic pool flow to PCOL/PBUSD-centered flow.
- More complete protocol feature set, but still not the final polished behavior.

## Suggested Commit Message
- `stage3: introduce PCOLBUSDPool architecture and receipt-token flow`
