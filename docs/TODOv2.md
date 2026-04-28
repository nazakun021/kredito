# TODO v2

This file tracks the current project direction from the perspective of the simplified demo.

Primary reference: [SPECv2.md](/Users/infinite/Programming/kredito/docs/SPECv2.md)

## Core Loop

- [x] Generate score
- [x] Borrow instantly
- [x] Repay
- [x] Refresh score

## Product Simplification

- [x] Remove OTP/signup friction from the primary flow
- [x] Auto-create wallet silently
- [~] Pre-fund demo wallets when environment allows
- [x] Reduce UI to 3-4 core screens
- [x] Eliminate non-essential onboarding flows

## On-Chain Scoring

- [x] Store metrics in `credit_registry`
- [x] Store score in `credit_registry`
- [x] Store tier in `credit_registry`
- [x] Implement deterministic score function
- [x] Map score to Bronze / Silver / Gold
- [x] Surface formula in UI
- [x] Surface raw metrics in UI

## Lending

- [x] Enforce eligibility from on-chain tier
- [x] Support borrow
- [x] Support repay
- [x] Support `mark_default`
- [x] Show pool balance in UI
- [x] Lower fees for stronger tiers

## Demo Magic

- [x] Screen 1: Generate score
- [x] Screen 2: Show metrics, formula, score, eligibility
- [x] Screen 3: Borrow
- [x] Screen 4: Repay and show score refresh

## Remaining Practical Gaps

- [ ] Verify full live loop against the intended deployed testnet contracts
- [ ] Confirm demo wallet prefunding works consistently in target environment
- [ ] Refresh contract IDs and public docs if deployment changes
- [ ] Record backup demo video

## Documentation

- [x] Make `SPECv2.md` the main spec
- [x] Update `README.md`
- [x] Update setup docs
- [ ] Audit older docs and archive or rewrite any remaining stale material
