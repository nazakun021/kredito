# Kredito Error Codes

This document lists the error codes used across the Kredito system, their meanings, and how they are handled.

## Contract Error Codes (Soroban)

These errors are emitted by the `lending_pool` and `credit_registry` smart contracts.

### Lending Pool Contract (`lending_pool`)

| Code  | Label                       | Meaning                                                             | User-Friendly Message                               |
| ----- | --------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| `#1`  | `AlreadyInitialized`        | Contract already has an admin/issuer set                            | "System is already configured"                      |
| `#2`  | `NotInitialized`            | Contract is being used before initialization                        | "System is not yet configured"                      |
| `#3`  | `InvalidFeeBps`             | Fee basis points exceed 100%                                        | "Invalid fee configuration"                         |
| `#4`  | `InvalidLoanTerm`           | Loan term ledgers set to zero                                       | "Invalid loan term"                                 |
| `#5`  | `InvalidAmount`             | Amount is zero or negative                                          | "Amount must be greater than zero"                  |
| `#6`  | `PoolBalanceOverflow`       | Pool balance would exceed storage limits                            | "Pool capacity exceeded"                            |
| `#7`  | `ActiveLoanExists`          | Borrower already has an unpaid/non-defaulted loan                   | "You already have an active loan"                   |
| `#8`  | `NoCreditTier`              | Borrower has no tier (Tier 0)                                       | "No credit score found — generate a score first"    |
| `#9`  | `BorrowLimitExceeded`       | Requested amount exceeds borrower's tier limit                      | "Amount exceeds your current tier limit"            |
| `#10` | `InsufficientPoolLiquidity` | Pool does not have enough XLM to cover the loan                     | "Insufficient pool liquidity"                       |
| `#11` | `FeeOverflow`               | Fee calculation resulted in overflow                                | "Calculation error"                                 |
| `#12` | `DueLedgerOverflow`         | Ledger calculation resulted in overflow                             | "Calculation error"                                 |
| `#13` | `LoanNotFound`              | No loan record exists for the borrower                              | "No active loan found"                              |
| `#14` | `LoanAlreadyRepaid`         | Borrower is trying to repay a settled loan                          | "Loan already repaid"                               |
| `#15` | `LoanDefaulted`             | Loan was previously marked as defaulted                             | "This loan has been defaulted and cannot be repaid" |
| `#16` | `LoanOverdue`               | Loan passed its due ledger and cannot be repaid (must be defaulted) | "This loan is overdue"                              |
| `#17` | `RepaymentOverflow`         | Total owed calculation resulted in overflow                         | "Calculation error"                                 |
| `#18` | `LoanNotOverdue`            | Issuer trying to mark a loan as defaulted before it is due          | "Loan is not yet overdue"                           |
| `#19` | `InsufficientStake`         | Staker trying to unstake more than their active staked balance      | "Insufficient staked balance"                       |
| `#20` | `TimeDepositExists`         | Depositor already has an active time deposit                        | "An active time deposit already exists"             |
| `#21` | `TimeDepositNotFound`       | Depositor trying to withdraw without an active time deposit         | "No active time deposit found"                      |
| `#22` | `KycRequired`               | Tier requires KYC verification but is not verified                  | "KYC verification required to unlock higher limit"  |

### Credit Registry Contract (`credit_registry`)

| Code | Label                | Meaning                                          | User-Friendly Message                 |
| ---- | -------------------- | ------------------------------------------------ | ------------------------------------- |
| `#1` | `AlreadyInitialized` | Contract is already configured                   | "System is already configured"        |
| `#2` | `NotInitialized`     | Contract is not yet configured                   | "System is not yet configured"        |
| `#3` | `InvalidTierLimits`  | One of the tier limits is negative or zero       | "Invalid tier limits"                 |
| `#4` | `TierOrderInvalid`   | Limits do not strictly increase by tier sequence | "Invalid tier limits order"           |
| `#5` | `InvalidTier`        | Tier value is not within valid ranges (1..=4)    | "Invalid tier value"                  |
| `#6` | `NonTransferable`    | Attempted to transfer registry state (soulbound) | "Soulbound state is non-transferable" |

---

## Backend Error Codes

The backend uses standard HTTP status codes and custom error messages to map raw Soroban output to descriptive exceptions.

| Status | Code/Message              | Meaning                                                   | Friendly UI Message                                                         |
| ------ | ------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `401`  | `Unauthorized`            | JWT missing, expired, or signature verification failed    | "Session expired, please connect your wallet again."                        |
| `422`  | `insufficientbalance`     | Borrower has less XLM in their wallet than the total owed | "Insufficient XLM balance for repayment"                                    |
| `422`  | `insufficientallowance`   | SAC approval failed to settle or was too small            | "Repayment approval did not settle correctly"                               |
| `400`  | `Invalid Stellar address` | Provided public key is malformed or invalid               | "Invalid Stellar address"                                                   |
| `400`  | `timeout`                 | Stellar transaction submission timed out                  | "Stellar confirmation timed out. Try again."                                |
| `500`  | `account not found`       | Wallet doesn't exist/isn't funded on the network          | "Wallet activation is still settling on Stellar. Please retry in a moment." |
| `503`  | `Contract Unavailable`    | Backend cannot reach Stellar RPC/Horizon                  | "Something went wrong. Contract may be temporarily unavailable."            |

---

## Frontend Error Handling

The frontend maps these errors dynamically to the UI using a centralized boundary handler:

1.  **Contract/Soroban Exceptions**: Standardizes XDR/RPC exception strings via the backend `errorHandler` into clean, friendly toast messages (via `sonner`).
2.  **Authentication Expiry**: Unauthorized `401` errors instantly trigger `clearAuth()` on the Zustand store, clearing credentials from `localStorage` and redirecting the user to the landing page.
3.  **Validation Pre-checks**: Before sending a transaction for repayment or deposits, the frontend validates the user's wallet balances and displays the exact XLM deficit, blocking the Freighter signature popup if the transaction is guaranteed to fail.
