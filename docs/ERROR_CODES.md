# Kredito Error Codes

This document lists the error codes used across the Kredito system, their meanings, and how they are handled.

## Contract Error Codes (Soroban)

These errors are emitted by the `lending_pool` and `credit_registry` smart contracts.

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
| `#10` | `InsufficientPoolLiquidity` | Pool does not have enough PHPC to cover the loan                    | "Insufficient pool liquidity"                       |
| `#11` | `FeeOverflow`               | Fee calculation resulted in overflow                                | "Calculation error"                                 |
| `#12` | `DueLedgerOverflow`         | Ledger calculation resulted in overflow                             | "Calculation error"                                 |
| `#13` | `LoanNotFound`              | No loan record exists for the borrower                              | "No active loan found"                              |
| `#14` | `LoanAlreadyRepaid`         | Borrower is trying to repay a settled loan                          | "Loan already repaid"                               |
| `#15` | `LoanDefaulted`             | Loan was previously marked as defaulted                             | "This loan has been defaulted and cannot be repaid" |
| `#16` | `LoanOverdue`               | Loan passed its due ledger and cannot be repaid (must be defaulted) | "This loan is overdue"                              |
| `#17` | `RepaymentOverflow`         | Total owed calculation resulted in overflow                         | "Calculation error"                                 |
| `#18` | `LoanNotOverdue`            | Issuer trying to mark a loan as defaulted before it is due          | "Loan is not yet overdue"                           |

## Backend Error Codes

The backend uses standard HTTP status codes and custom error messages.

| Status | Code/Message              | Meaning                                                |
| ------ | ------------------------- | ------------------------------------------------------ |
| `401`  | `Unauthorized`            | JWT missing, expired, or signature verification failed |
| `422`  | `InsufficientBalance`     | Borrower has insufficient PHPC for repayment           |
| `400`  | `Invalid Stellar address` | Provided public key is malformed                       |
| `400`  | `Timeout`                 | Stellar transaction submission timed out               |
| `503`  | `Contract Unavailable`    | Backend cannot reach Stellar RPC/Horizon               |

## Frontend Error Handling

The frontend maps these errors to the UI via `lib/errors.ts`:

1.  **Contract Errors**: Mapped via backend `errorHandler` to friendly strings.
2.  **Auth Errors**: Triggers `clearAuth()` and redirects to home.
3.  **Repayment Shortfall**: Displays the exact PHPC amount needed before allowing the sign flow.
