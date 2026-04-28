# SPEC.md — Kredito Bootstrap & Identity Layer

### Addendum to Core Kredito Spec · Version 2.0

### Last Updated: 2026-04-28

### Change from v1.0: Phone SMS OTP replaced with Email OTP via Resend (free tier). All phone references updated. New §3 Resend Integration added.

---

## 0. Why This Document Exists

The core Kredito spec assumes users already have Stellar wallet history. This assumption breaks for the exact person Kredito is built for: a sari-sari store owner who has never touched a blockchain in her life.

Her first computed score under the original algorithm:

```
AccountAge:         0 pts  (wallet created today)
TxVolume:           0 pts  (zero transactions)
RepaymentHistory:   0 pts  (no prior loans)
─────────────────────────
Total:              0/100  → Tier 0 → No loan access
```

This document defines the full solution: a two-layer scoring model that allows any first-time user to access credit through verified off-chain signals, while building toward a future where her score is entirely derived from trustless on-chain history.

---

## 1. The Bootstrapping Paradox, Defined

### 1.1 Root Cause

The original scoring model is retrospective. It scores behaviour that has already happened on Stellar. A new user has no behaviour on Stellar. The model has nothing to read.

This is not a bug in the code — it is a structural limitation of any on-chain credit system applied to users who are new to that chain. Every real-world DeFi credit protocol faces this exact problem. Aave, Goldfinch, and Maple Finance all solved it with off-chain identity or institutional guarantees. Kredito solves it at the individual level with an email-verified bootstrap assessment — free to operate, zero infrastructure cost, and upgradeable to phone SIM verification post-hackathon.

### 1.2 The Two Problems Are Distinct

| Problem                             | Description                                                                                                                            | Already Solved?                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **She has no Stellar wallet**       | Maria has never used Stellar. She cannot sign a transaction.                                                                           | ✅ Yes — the backend generates an embedded wallet on email login. She has a wallet the moment she signs up. |
| **Her financial life is off-chain** | Her GCash history, remittances, and sales exist in private databases, not on Stellar. The on-chain scoring algorithm cannot read them. | ❌ No — this is the paradox. This document solves it.                                                       |

### 1.3 What Cannot Be Done

- GCash transaction history cannot be read directly. GCash has no public API and no consent mechanism for third-party access.
- Philippine credit bureau data (CIC) cannot be accessed without formal institutional accreditation — not available at hackathon scope.
- Requiring a prior Stellar wallet defeats the entire purpose of the product.
- Storing Maria's personal financial data on the Stellar blockchain would be a privacy violation and is technically unnecessary.
- SMS OTP has no genuinely free tier: Twilio's $15.50 trial credit only sends to pre-verified numbers, making it unusable for real users. SendGrid removed its permanent free plan in May 2025.

### 1.4 What Can Be Done

The backend acts as a **trusted attester** — the same role that Equifax plays for Citibank, or that a cooperative treasurer plays for a member loan. It collects verifiable off-chain signals, makes a creditworthiness assessment, and writes only the outcome (an SBT tier) to the chain. The evidence stays private. The conclusion is public and permanent.

For the MVP, identity verification uses **email OTP via Resend** — a permanently free tier (3,000 emails/month, 100/day) with a Node.js SDK that integrates in under 30 minutes. On mainnet, this upgrades to Philippine SIM verification (Semaphore or Globe Labs API) for stronger geographic identity signal under RA 11934. No scoring formula changes are required for that upgrade — only the delivery channel changes.

---

## 2. The Two-Layer Scoring Model

### 2.1 Model Overview

```
TOTAL SCORE (0–100)
│
├── LAYER 1: Off-Chain Bootstrap Score (0–50 pts)
│   Purpose: Get first-time users to Tier 1 without any Stellar history
│   Source:  Email OTP verification (Resend) + self-declared financial data + community attestation
│   Storage: Private — stored in backend DB only, never written to chain
│   Decay:   Bootstrap score weight decreases as on-chain history grows (see §2.4)
│
└── LAYER 2: On-Chain Stellar Score (0–50 pts)
    Purpose: Build a fully trustless score over time
    Source:  Horizon API + Kredito repayment events from lending_pool contract
    Storage: Public — all inputs are on-chain and verifiable by anyone
    Growth:  Each on-time repayment adds 25 pts to this layer (uncapped)
```

### 2.2 Layer 1: Bootstrap Score Breakdown (0–50 pts)

---

#### 2.2.1 Factor: Email Verification via Resend (0–15 pts)

| Condition               | Points | Label                     |
| ----------------------- | ------ | ------------------------- |
| Email not verified      | 0 pts  | "Email not verified"      |
| OTP verified via Resend | 15 pts | "Email address confirmed" |

**What this proves:** The user owns a real, active email inbox. This is the minimum viable identity signal — it filters out bots and throwaway signups while requiring zero cost and zero infrastructure beyond a Resend API key. It does not prove Philippine residency (unlike phone SIM verification), but it proves the user is a real person committing a real email address to the application.

**Why email OTP, not SMS OTP:** SMS has no free tier viable for real users at hackathon scope. Resend's permanent free tier (3,000 emails/month, 100/day) covers the entire hackathon demo and early user testing at $0 cost. The verification signal is equivalent for fraud prevention at the ₱5,000 loan size — the cost of fraud (SBT blacklisting, default record) still exceeds the loan value.

**Verification flow:**

1. User is shown their pre-filled login email on the onboarding screen
2. Backend generates a 6-digit OTP, stores it hashed in the DB with a 10-minute expiry
3. Resend sends a transactional email with the OTP from `verify@kredito.app`
4. User enters the 6-digit code in the frontend
5. Backend validates the hash match and expiry
6. On success: `email_verified = true` written to `users` table — permanent flag, never reset
7. Bootstrap assessment can now proceed to Step 2

**Email template subject:** `Your Kredito verification code: {OTP}`
**Email template body:** Clean, minimal. Code displayed large. "This code expires in 10 minutes. If you did not request this, ignore this email." No marketing copy in the transactional email.

**Rate limiting:** Maximum 3 OTP sends per user per hour. After 3 failed verification attempts in 10 minutes, the current OTP is invalidated and a new send is required.

**V2 upgrade path — Philippine SIM verification:** Replace Resend with Semaphore PH SMS API (₱0.50/OTP). Change the delivery channel in one backend service file. Rename the DB field from `email_verified` to `contact_verified`. The scoring weight stays at 15 pts. The label changes to "Philippine number confirmed" and gains the RA 11934 geographic signal. No contract changes, no frontend changes, no scoring formula changes.

---

#### 2.2.2 Factor: Declared Financial Profile (0–20 pts)

Self-reported data. The user explicitly declares these values. They are not verified by any third party at MVP scope — but they are recorded, timestamped, and used as the basis for loan eligibility. If a user provides false information and defaults, this record supports future dispute resolution.

| Sub-factor        | Condition                            | Points  | Label                           |
| ----------------- | ------------------------------------ | ------- | ------------------------------- |
| Monthly income    | Declared ≥ ₱10,000/month             | +10 pts | "Income above ₱10,000 declared" |
| Monthly income    | Declared ₱5,000–₱9,999/month         | +5 pts  | "Income declared"               |
| Monthly income    | Declared < ₱5,000 or not declared    | 0 pts   | —                               |
| Cash flow ratio   | (Income − Expenses) / Income ≥ 30%   | +5 pts  | "Positive cash flow declared"   |
| Cash flow ratio   | Ratio < 30% or expenses not declared | 0 pts   | —                               |
| Employment status | Self-employed / Business owner       | +5 pts  | "Business owner on record"      |
| Employment status | Employed / Regular income            | +3 pts  | "Regular income declared"       |
| Employment status | Irregular / not declared             | 0 pts   | —                               |

**Maximum from this factor: 20 pts**

**Data privacy note:** Income and expense figures are stored in the `bootstrap_assessments` table in the backend database. They are never written to the Stellar chain. They are never returned to the frontend after initial submission. They exist solely as the basis for the score calculation and for audit purposes in the event of a dispute.

---

#### 2.2.3 Factor: Community Attestation (0–15 pts)

Checkboxes. Self-declared at MVP. Each represents a real-world institutional relationship that makes default less likely — cooperative membership means she has peers who know her, a business permit means she has a registered livelihood to protect, a barangay certificate means local government has verified her address and business.

| Attestation                                       | Points | Label                         |
| ------------------------------------------------- | ------ | ----------------------------- |
| Has DTI-registered business or Mayor's Permit     | +5 pts | "Registered business"         |
| Has barangay business certificate                 | +5 pts | "Community-verified business" |
| Active member of a cooperative or paluwagan group | +5 pts | "Cooperative member"          |

**Maximum from this factor: 15 pts**

**Why checkboxes are acceptable at MVP:** False declaration is a form of fraud. The loan amount (₱5,000) is low enough that the cost of fraud (default, blacklisted SBT, potential cooperative reporting) exceeds the benefit. More importantly, the hackathon scope requires a demonstrable flow — checkbox attestation is demonstrable in a 60-second demo. Document upload is not.

**V2 upgrade path:** Document upload + OCR verification of permit numbers against DTI and DOLE public registries. This would shift these from self-declared to verified and could increase point values by 2x.

---

### 2.3 Layer 2: On-Chain Stellar Score (0–50 pts)

This layer is unchanged from the core spec scoring algorithm, but the maximum is capped at 50 in the two-layer model (rather than 100).

| Factor             | Source                                                          | Points   |
| ------------------ | --------------------------------------------------------------- | -------- |
| Account Age        | Horizon API `/accounts/{id}`                                    | 0–10 pts |
| Transaction Volume | Horizon API `/accounts/{id}/transactions`                       | 0–15 pts |
| Repayment History  | `lending_pool` contract events: `loan_repaid`, `loan_defaulted` | 0–25 pts |

**Repayment History detail:**

| Condition               | Points            | Label                     |
| ----------------------- | ----------------- | ------------------------- |
| No prior loans          | 0 pts             | "No loan history yet"     |
| 1 loan repaid on time   | +15 pts           | "1 loan repaid on time"   |
| 2 loans repaid on time  | +20 pts           | "2 loans repaid on time"  |
| 3+ loans repaid on time | +25 pts           | "Strong repayment record" |
| Any default on record   | −20 pts (floor 0) | "Default on record"       |

**This factor is the most powerful in the entire model.** After 3 on-time repayments, a user can achieve a near-perfect Layer 2 score (10 + 15 + 25 = 50 pts) regardless of their Layer 1 bootstrap score. The protocol becomes self-sustaining — the bootstrap layer is no longer needed once a user has on-chain loan history.

---

### 2.4 Score Merge Formula

```
Total Score = min(100, BootstrapScore + StellarScore)

Tier Assignment:
  0–39   → Tier 0 | "Unscored"       | No loan access
  40–69  → Tier 1 | "Basic Credit"   | Borrow up to ₱5,000
  70–100 → Tier 2 | "Trusted Credit" | Borrow up to ₱20,000
```

### 2.5 Score Progression: Maria's Journey

| Stage                                | Bootstrap    | Stellar       | Total | Tier  | Action                  |
| ------------------------------------ | ------------ | ------------- | ----- | ----- | ----------------------- |
| Signs up, no history                 | 0            | 0             | 0     | 0     | Goes to onboarding      |
| Verifies email via Resend OTP        | 15           | 0             | 15    | 0     | Needs more info         |
| Declares income ₱18k, business owner | 15+10+5 = 30 | 0             | 30    | 0     | Still below Tier 1      |
| Checks business permit + brgy cert   | 30+5+5 = 40  | 0             | 40    | **1** | **First loan unlocked** |
| Repays 1st loan on time              | 40           | 15            | 55    | 1     | Tier 1 reinforced       |
| Account 45 days old, 38 txs          | 40           | 15+10+15 = 40 | 80    | **2** | **Tier 2 unlocked**     |
| 3rd loan repaid on time              | 40           | 10+15+25 = 50 | 90    | 2     | Near-maximum score      |

At stage 6, Maria's on-chain score alone (40 pts) is enough for Tier 1. The bootstrap layer is no longer the deciding factor. After stage 7, her on-chain score alone (50 pts) gets her to Tier 2 without any bootstrap contribution.

---

## 3. Resend Integration

### 3.1 Why Resend

| Provider           | Free Tier                                      | Trial Limits                          | No Credit Card | PH Delivery  |
| ------------------ | ---------------------------------------------- | ------------------------------------- | -------------- | ------------ |
| **Resend**         | 3,000 emails/mo, 100/day — **permanent**       | None                                  | ✅             | ✅           |
| Twilio SMS         | $15.50 credit only                             | Can only message pre-verified numbers | ✅             | ✅           |
| SendGrid           | 60-day trial only (free plan removed May 2025) | 100/day, time-limited                 | ✅             | ✅           |
| Nodemailer + Gmail | Unlimited (500/day)                            | None                                  | ✅             | ⚠️ Spam risk |
| Semaphore PH       | No free tier                                   | —                                     | ❌             | ✅           |

Resend is the only provider with a permanent free tier, a modern Node.js/TypeScript SDK, and first-class deliverability — all at zero cost. For a hackathon demo, 100 emails per day is effectively infinite.

### 3.2 Environment Variables

Add to `backend/.env`:

```env
# Resend Email OTP
RESEND_API_KEY=re_...              # Get from resend.com/api-keys (free account)
RESEND_FROM_EMAIL=verify@kredito.app   # Must be from a domain you own
                                        # OR use Resend's onboarding address for testing:
                                        # onboarding@resend.dev (works without domain setup)
OTP_EXPIRY_MINUTES=10              # OTP valid window
OTP_MAX_ATTEMPTS=3                 # Failed attempts before lockout
OTP_RATE_LIMIT_WINDOW_HOURS=1      # Max sends per user per window
OTP_RATE_LIMIT_MAX_SENDS=3         # Max OTPs sent per user per window
```

**Domain setup note:** For the hackathon demo, `onboarding@resend.dev` works immediately with no domain configuration. For production, add a DNS TXT record to verify `kredito.app` in the Resend dashboard — takes 5 minutes. Use the production domain from day one if possible: `verify@kredito.app` looks credible to judges reviewing email screenshots.

### 3.3 Database Changes

Add the following columns to the `users` table, and add the `otp_requests` table:

```sql
-- Add to existing users table
ALTER TABLE users ADD COLUMN email_verified     BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN otp_hash           TEXT;       -- bcrypt hash of current OTP
ALTER TABLE users ADD COLUMN otp_expires_at     DATETIME;   -- expiry timestamp
ALTER TABLE users ADD COLUMN otp_attempt_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN otp_locked_until   DATETIME;   -- null = not locked

-- New table for rate limiting
CREATE TABLE otp_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Index for fast rate limit queries
CREATE INDEX idx_otp_requests_user_time
    ON otp_requests(user_id, sent_at);
```

**Why bcrypt-hash the OTP:** A plain 6-digit OTP stored in plaintext is a security liability. If the SQLite file is ever accessed, all pending OTPs are exposed. Bcrypt-hashing a 6-digit number with a low cost factor (10) takes ~100ms — acceptable for server-side verification, fast enough to not affect UX.

### 3.4 Resend Email Service: Specification

**File:** `backend/src/services/emailOtp.ts`

This service is the single point of contact with the Resend API. No other file should import the Resend SDK directly.

**Functions to implement:**

---

`generateOtp(): string`

- Returns a cryptographically random 6-digit string using `crypto.randomInt(100000, 999999)`
- Zero-padded to always return exactly 6 digits
- Must use `crypto.randomInt` — not `Math.random()` which is not cryptographically random

---

`sendOtp(userId: number, email: string): Promise<{ sent: boolean, expiresAt: Date }>`

Ordered execution:

1. Check rate limit: count rows in `otp_requests` for `user_id` in the last `OTP_RATE_LIMIT_WINDOW_HOURS` hours
2. If count ≥ `OTP_RATE_LIMIT_MAX_SENDS`: throw `OtpRateLimitError`
3. Check lockout: if `otp_locked_until` is set and in the future: throw `OtpLockedError` with remaining time
4. Generate OTP with `generateOtp()`
5. Compute expiry: `new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)`
6. Hash OTP with `bcrypt.hash(otp, 10)`
7. Update `users` row: set `otp_hash`, `otp_expires_at`, reset `otp_attempt_count = 0`
8. Insert row into `otp_requests`
9. Call Resend API (see §3.5 for email template)
10. Return `{ sent: true, expiresAt }`

---

`verifyOtp(userId: number, submittedOtp: string): Promise<{ verified: boolean }>`

Ordered execution:

1. Fetch user row — get `otp_hash`, `otp_expires_at`, `otp_attempt_count`, `otp_locked_until`
2. Check lockout: if locked and in future, throw `OtpLockedError`
3. Check expiry: if `otp_expires_at < now`, throw `OtpExpiredError`
4. Compare: `bcrypt.compare(submittedOtp, otp_hash)`
5. If **no match**:
   - Increment `otp_attempt_count`
   - If `otp_attempt_count ≥ OTP_MAX_ATTEMPTS`: set `otp_locked_until = now + 10 minutes`, clear `otp_hash`
   - Throw `OtpInvalidError` (do NOT reveal attempt count to client — say "Invalid code")
6. If **match**:
   - Set `email_verified = true`
   - Clear `otp_hash`, `otp_expires_at`, reset `otp_attempt_count = 0`
   - Return `{ verified: true }`

---

**Custom error types:**

```
OtpRateLimitError   — "Too many verification attempts. Try again in {N} minutes."
OtpLockedError      — "Too many incorrect codes. Try again in {N} minutes."
OtpExpiredError     — "This code has expired. Request a new one."
OtpInvalidError     — "Invalid code. Please check and try again."
```

**Important:** None of these error messages reveal the stored hash, attempt count, or exact lockout time. Generic messaging prevents enumeration attacks.

### 3.5 Email Template Specification

The OTP email must be simple, clear, and not look like spam. No images, no marketing copy, no links except a single support contact.

```
FROM:    verify@kredito.app  (display name: "Kredito")
TO:      {user email}
SUBJECT: Your Kredito verification code: {OTP}

BODY (plain text + HTML):

  Your verification code is:

  ┌─────────────┐
  │   {OTP}     │
  └─────────────┘

  This code expires in 10 minutes.

  Enter this code on the Kredito app to verify your
  email and unlock your credit score.

  If you did not request this code, you can safely
  ignore this email.

  — The Kredito Team
```

**HTML version requirements:**

- OTP displayed in a large monospace font (`font-size: 32px; letter-spacing: 8px; font-family: monospace`)
- Single-column layout, max-width 480px
- Background: white, text: #111
- No images, no tracking pixels
- Unsubscribe link not needed (transactional email, not marketing)

### 3.6 Resend API Call Structure

The backend calls Resend's `/emails` endpoint via their Node.js SDK:

```
Method:  POST https://api.resend.com/emails
Auth:    Authorization: Bearer {RESEND_API_KEY}

Payload:
{
  from:    "Kredito <verify@kredito.app>",
  to:      ["{user_email}"],
  subject: "Your Kredito verification code: {OTP}",
  html:    "{rendered HTML template}",
  text:    "{plain text fallback}"
}

Expected response 200:
{ "id": "re_xxxxxxxx" }

On error:
- 429 (rate limited by Resend): retry after 1 second, max 2 retries
- 422 (invalid email): throw EmailInvalidError, do not retry
- 5xx: throw EmailDeliveryError, surface to user as "Couldn't send code — try again"
```

### 3.7 Free Tier Limits & Hackathon Impact

| Resend Free Limit     | Hackathon Scenario            | Impact    |
| --------------------- | ----------------------------- | --------- |
| 100 emails/day        | Demo day: ~10 OTP sends       | No impact |
| 3,000 emails/month    | Testing + demo: ~50–100 sends | No impact |
| 1 domain              | `kredito.app`                 | No impact |
| Rate limit: 5 req/sec | Sequential OTP sends          | No impact |

The free tier is more than sufficient for the entire hackathon lifecycle including development, testing, judges accessing the demo, and live demo day sends. No upgrade required at any point during the hackathon.

**If the 100/day cap is hit during heavy judging:** Switch the `RESEND_FROM_EMAIL` to `onboarding@resend.dev` — Resend's shared testing domain has a separate quota from your personal free tier. This is documented in Resend's onboarding and takes 30 seconds to change.

---

## 4. User Flow: First-Time User

### 4.1 Complete Onboarding Flow (New User)

```
[/login]
  User enters email
  Backend creates embedded Stellar wallet
  JWT issued
  → Redirect to /dashboard

[/dashboard]
  Backend calls computeFullScore()
  StellarScore = 0, BootstrapScore = 0, Total = 0
  Dashboard detects Tier 0 with no bootstrap on record
  → Shows <OnboardingPrompt /> component
  → "Unlock your credit line — takes 2 minutes"
  → CTA button: "Start Verification" → /onboarding

[/onboarding — Step 1: Email Verification]
  User's login email displayed (pre-filled, read-only)
  "Send verification code to {email}" button
  Backend: calls emailOtp.sendOtp() via Resend
  6-digit code input field appears
  User enters code from email inbox
  Backend: calls emailOtp.verifyOtp()
  On success: email_verified = true, advance to Step 2
  On error: inline error message (see §3.4 error types)

[/onboarding — Step 2: Financial Profile]
  Input: Monthly income (dropdown: <₱5k / ₱5k–₱10k / ₱10k–₱20k / >₱20k)
  Input: Monthly expenses (same dropdown)
  Input: Employment type (Self-employed / Employed / Irregular)
  Live score preview: "Estimated score so far: {N}/100"
  → Advance to Step 3

[/onboarding — Step 3: Community Attestation]
  Checkboxes:
  [ ] I have a DTI-registered business or Mayor's Permit
  [ ] I have a barangay business certificate
  [ ] I am an active member of a cooperative or paluwagan
  → "Submit and Check My Score"

[/onboarding — Result]
  Backend: computeBootstrapScore() from all collected data
  Backend: mergeScores(bootstrapScore, stellarScore)
  Backend: if total >= 40 → call credit_registry::set_tier(wallet, 1)
  Frontend: animated score reveal
  If Tier 1: "Credit Approved. You can borrow up to ₱5,000." → CTA to /loan/borrow
  If Tier 0: "Score: {N}/100. You need 40 points to qualify." → gap analysis
```

### 4.2 Gap Analysis Screen (Tier 0 After Onboarding)

If the user completes onboarding but scores below 40, show them exactly what they need:

```
Your Score: 35 / 100
You need 5 more points to unlock your first loan.

Here is how to get there:
  ✓ Email verified            +15 pts  [Done]
  ✓ Income declared           +10 pts  [Done]
  ✓ Business permit           + 5 pts  [Done]
  ✗ Barangay certificate      + 5 pts  [Add this → checkbox]
  ✗ Cooperative membership    + 5 pts  [Add this → checkbox]

Adding a barangay certificate or cooperative membership
will bring your score to 40 and unlock your first loan.
```

Never tell the user "you don't qualify" without telling them exactly what to do next.

### 4.3 Returning User Flow (Has Prior Bootstrap)

```
[/dashboard loads]
  Backend: fetch latest bootstrap_score from score_events
  Backend: fetch live stellarScore from Horizon + contract events
  Backend: total = bootstrapScore + stellarScore
  If tier changed: call set_tier() on registry
  Frontend: render dashboard with current tier and score breakdown
  No onboarding prompt shown — email already verified, bootstrap already complete
```

---

## 5. Data Architecture

### 5.1 Database Tables

#### `users` table — additions to existing schema

```sql
ALTER TABLE users ADD COLUMN email_verified     BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN otp_hash           TEXT;
ALTER TABLE users ADD COLUMN otp_expires_at     DATETIME;
ALTER TABLE users ADD COLUMN otp_attempt_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN otp_locked_until   DATETIME;
```

#### `otp_requests` table — new, for rate limiting

```sql
CREATE TABLE otp_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_otp_requests_user_time ON otp_requests(user_id, sent_at);
```

#### `bootstrap_assessments` table — new

```sql
CREATE TABLE bootstrap_assessments (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id              INTEGER NOT NULL REFERENCES users(id),
    email_verified       BOOLEAN NOT NULL DEFAULT 0,
    monthly_income_band  TEXT NOT NULL,   -- "<5k"|"5k-10k"|"10k-20k"|">20k"
    monthly_expense_band TEXT NOT NULL,
    employment_type      TEXT NOT NULL,   -- "self_employed"|"employed"|"irregular"
    has_business_permit  BOOLEAN NOT NULL DEFAULT 0,
    has_brgy_certificate BOOLEAN NOT NULL DEFAULT 0,
    has_coop_membership  BOOLEAN NOT NULL DEFAULT 0,
    bootstrap_score      INTEGER NOT NULL,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `score_events` table — modified columns

```sql
-- Add to existing score_events table
ALTER TABLE score_events ADD COLUMN bootstrap_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE score_events ADD COLUMN stellar_score   INTEGER NOT NULL DEFAULT 0;
```

### 5.2 What Goes On-Chain vs. Off-Chain

| Data                      | On-Chain? | Where Stored                                  | Why                           |
| ------------------------- | --------- | --------------------------------------------- | ----------------------------- |
| Credit tier (0/1/2)       | ✅ Yes    | `credit_registry` contract                    | Public, verifiable, permanent |
| SBT ownership             | ✅ Yes    | `credit_registry` contract                    | Non-transferable proof        |
| `tier_set` event          | ✅ Yes    | Stellar event log                             | Audit trail                   |
| Loan records              | ✅ Yes    | `lending_pool` contract                       | Repayment enforcement         |
| Bootstrap score breakdown | ❌ No     | Backend SQLite                                | Private attestation data      |
| Email address             | ❌ No     | Backend SQLite (plaintext needed for sending) | PII                           |
| OTP hash                  | ❌ No     | Backend SQLite (bcrypt)                       | Short-lived credential        |
| Income declaration        | ❌ No     | Backend SQLite (banded)                       | PII                           |
| Community checkboxes      | ❌ No     | Backend SQLite                                | Self-declared                 |

---

## 6. API Endpoints

All protected routes require `Authorization: Bearer <jwt>` header.

---

### `POST /api/onboarding/send-otp` _(auth required)_

Sends a 6-digit OTP to the user's login email via Resend.

```
Request body:  (none — email is taken from the authenticated user's record)

Backend logic:
  1. Load user by req.userId
  2. If user.email_verified == true: return 200 { alreadyVerified: true } — no OTP sent
  3. Call emailOtp.sendOtp(user.id, user.email)
  4. Return response

Response 200:  {
  "sent": true,
  "email": "m***a@gmail.com",   -- masked, for display only
  "expiresIn": 600               -- seconds
}

Response 200 (already verified):  {
  "alreadyVerified": true
}

Error 429:  { "error": "Too many verification attempts. Try again in {N} minutes." }
Error 500:  { "error": "Couldn't send verification code. Please try again." }
```

---

### `POST /api/onboarding/verify-otp` _(auth required)_

Validates the submitted 6-digit OTP.

```
Request body:  { "otp": "123456" }

Validation:
  - otp must be exactly 6 digits (Zod: z.string().regex(/^\d{6}$/))

Backend logic:
  1. Call emailOtp.verifyOtp(req.userId, body.otp)
  2. On success: return verified response
  3. On error: return appropriate error

Response 200:  { "verified": true }

Error 400:  { "error": "Invalid code. Please check and try again." }
Error 400:  { "error": "This code has expired. Request a new one." }
Error 423:  { "error": "Too many incorrect codes. Try again in {N} minutes." }
```

---

### `POST /api/onboarding/submit` _(auth required)_

Accepts the full bootstrap form, computes the bootstrap score, mints SBT if qualified.

```
Request body: {
  "monthlyIncomeBand":    "<5k" | "5k-10k" | "10k-20k" | ">20k",
  "monthlyExpenseBand":   "<5k" | "5k-10k" | "10k-20k" | ">20k",
  "employmentType":       "self_employed" | "employed" | "irregular",
  "hasBusinessPermit":    boolean,
  "hasBrgyCertificate":   boolean,
  "hasCoopMembership":    boolean
}

Guard: email_verified must be true — reject 403 if not

Backend logic (ordered):
  1. Validate all fields with Zod
  2. Verify user.email_verified == true, else: 403 "Complete email verification first"
  3. Compute bootstrapScore from submitted data (formula in §2.2)
  4. Fetch live stellarScore from Horizon + contract events
  5. Compute total = bootstrapScore + stellarScore
  6. Assign tier from total
  7. Insert row into bootstrap_assessments
  8. Insert row into score_events
  9. If tier >= 1: call credit_registry::set_tier(wallet, tier) via fee-bump
  10. Return full score response

Response 200: {
  "bootstrapScore": 40,
  "stellarScore": 0,
  "totalScore": 40,
  "tier": 1,
  "tierLabel": "Basic Credit",
  "borrowLimit": "5,000.00",
  "breakdown": {
    "emailVerified":      { "score": 15, "max": 15, "label": "Email address confirmed" },
    "incomeDeclaration":  { "score": 10, "max": 20, "label": "Income above ₱10,000 declared" },
    "cashFlowRatio":      { "score": 5,  "max": 5,  "label": "Positive cash flow declared" },
    "businessPermit":     { "score": 5,  "max": 5,  "label": "Registered business" },
    "brgyCertificate":    { "score": 0,  "max": 5,  "label": "Not declared" },
    "coopMembership":     { "score": 5,  "max": 5,  "label": "Cooperative member" }
  },
  "gapToNextTier": null,
  "sbtMinted": true,
  "sbtTxHash": "abc123..."
}

Response 200 (Tier 0): {
  ...same shape...
  "tier": 0,
  "gapToNextTier": {
    "pointsNeeded": 5,
    "suggestions": [
      { "action": "hasBrgyCertificate", "points": 5, "label": "Add barangay certificate" },
      { "action": "hasCoopMembership",  "points": 5, "label": "Add cooperative membership" }
    ]
  },
  "sbtMinted": false,
  "sbtTxHash": null
}

Error 403:  { "error": "Complete email verification before submitting." }
```

---

### `GET /api/onboarding/status` _(auth required)_

Returns current onboarding completion state.

```
Response 200: {
  "hasCompletedBootstrap": true,
  "emailVerified": true,
  "bootstrapScore": 40,
  "canSkipOnboarding": false   -- true only if stellarScore alone >= 40
}
```

---

## 7. Frontend: New Screens

### 7.1 Route Map Addition

```
/onboarding              → Multi-step bootstrap flow (new users only)
/onboarding/email        → Step 1: Email OTP verification
/onboarding/profile      → Step 2: Financial profile declaration
/onboarding/attestation  → Step 3: Community attestation checkboxes
/onboarding/result       → Score reveal + gap analysis or success
```

### 7.2 Dashboard: Conditional Onboarding Prompt

**State: Tier 0, bootstrap not yet completed**

```
Icon: lock
Heading: "Unlock your credit line"
Body: "Answer a few questions about your finances to check if you qualify."
CTA: "Start — takes 2 minutes" → /onboarding
```

**State: Tier 0, bootstrap completed, score too low**

```
Icon: chart-bar
Heading: "Score: {N}/100 — You need 40 to qualify"
Body: "You are {gap} points away from your first loan."
CTA: "See how to improve" → /onboarding/result (gap analysis)
```

### 7.3 `/onboarding/email` — Step 1

- Display: "We'll send a verification code to {masked email}"
- "Send Code" button → calls `POST /api/onboarding/send-otp`
- **Loading state:** "Sending code..." spinner
- **After send:** 6-digit OTP input appears
  - Single input field, `inputmode="numeric"`, `maxlength="6"`, `autocomplete="one-time-code"`
  - 10-minute countdown timer (e.g. "Code expires in 9:47")
  - "Didn't receive it? Resend" link (active after 60 seconds, disabled if rate limit hit)
- **Submit:** calls `POST /api/onboarding/verify-otp`
- **On success:** green checkmark "Email verified ✓", auto-advance to Step 2 after 1.5s
- **On error:** inline error message per error type (invalid / expired / locked)
- Progress indicator: Step 1 of 3

**`autocomplete="one-time-code"` note:** This attribute tells iOS and Android to suggest the OTP from the SMS/email automatically. On Android, it enables the SMS Retrieval API. On iOS, it reads from the email inbox if the email client is the default. This single attribute halves the time users spend on this step.

### 7.4 `/onboarding/profile` — Step 2

- Monthly income dropdown: `Less than ₱5,000 / ₱5,000–₱10,000 / ₱10,000–₱20,000 / More than ₱20,000`
- Monthly expenses dropdown (same options)
- Employment type radio: `Business owner / Regularly employed / Irregular income`
- Live score preview: "Estimated score so far: {N}/100" — updates as user fills fields
- Progress indicator: Step 2 of 3

### 7.5 `/onboarding/attestation` — Step 3

- Section heading: "Do any of these apply to you?"
- Three checkboxes with point labels:
  - `[ ]` **Registered business** — "I have a DTI, SEC, or Mayor's Permit" (+5 pts)
  - `[ ]` **Barangay certificate** — "I have a barangay business or residency certificate" (+5 pts)
  - `[ ]` **Cooperative or paluwagan** — "I am an active member of a cooperative or paluwagan" (+5 pts)
- Live total score preview updates per checkbox tick
- "Submit and Check My Score" button → `POST /api/onboarding/submit`
- Fine print: "Your answers are recorded and used to determine loan eligibility. False declarations may affect your account standing."
- Progress indicator: Step 3 of 3

### 7.6 `/onboarding/result` — Score Reveal

**Approved (Tier 1 or 2):**

- Animated score counter (0 → actual score, ~1.5s CSS transition)
- Tier badge with colour
- "Credit line unlocked: up to ₱{limit}"
- Score breakdown table (all 6 factors with points earned and max)
- CTA: "Borrow ₱5,000 Now" → `/loan/borrow`

**Not yet qualified (Tier 0):**

- Score shown: "{N} / 100"
- "You need {gap} more points to unlock your first loan."
- Gap analysis list (inline checkboxes for remaining attestations)
- On checkbox update: re-calls `POST /api/onboarding/submit` with updated data
- CTA if still Tier 0: "Come back after adding these documents"

### 7.7 Score Breakdown Page — Updated for Two Layers

`/score` displays both layers separately:

```
Your Total Score: 62 / 100 → Basic Credit

┌─────────────────────────────────────────┐
│ ON-CHAIN SCORE (22 / 50)                │
│ ─────────────────────────────────────── │
│ Account Age         10 / 10  45 days    │
│ Transaction Volume  12 / 15  38 txs     │
│ Repayment History    0 / 25  No loans   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ VERIFIED PROFILE SCORE (40 / 50)        │
│ ─────────────────────────────────────── │
│ Email verified      15 / 15  ✓          │
│ Income declared     10 / 20  ₱10k–₱20k  │
│ Cash flow            5 / 5   ✓          │
│ Business permit      5 / 10  ✓          │
│ Brgy certificate     5 / 10  ✓          │
│ Coop membership      0 / 5   Not added  │
└─────────────────────────────────────────┘
```

---

## 8. Privacy & Trust Architecture

### 8.1 The Attester Model

```
Maria                    Kredito Backend              Stellar Chain
─────                    ───────────────              ─────────────
Enters email      ──────► Creates embedded wallet
Verifies email OTP──────► Validates via Resend
Declares income   ──────► Stores privately (banded)
Checks boxes      ──────► Computes bootstrap score
                          ──────────────────────────► Mints SBT: Tier 1

                                                       Public record:
                                                       "Wallet G... is Tier 1"

                                                       Private record (backend only):
                                                       "Because: email ✓, income ✓, permit ✓"
```

The chain stores only the conclusion. The evidence stays private. This is the same model used by every real-world credit system.

### 8.2 What Users Are Told About Their Data

Displayed on `/onboarding/profile` before the income fields:

> _"Your financial information is stored securely on our servers and is never shared with third parties or written to the blockchain. Only your credit tier — not your personal details — is recorded on Stellar. You can request deletion of your profile data at any time by contacting support."_

### 8.3 What Happens to Data If a User Defaults

1. `lending_pool::mark_default()` called — on-chain, permanent, public
2. `credit_registry::revoke_tier()` called — SBT set to Tier 0 — on-chain, permanent
3. `bootstrap_assessments` row NOT deleted — remains as audit trail
4. New `score_events` row inserted with `tier = 0`

The user may re-apply for a new bootstrap assessment after 90 days. Their new score will carry the on-chain default penalty (−20 pts) for as long as the event exists on the ledger.

---

## 9. Demo Impact

### 9.1 Why This Makes the Demo Stronger

| Original Demo                                               | Bootstrap + Email OTP Demo                         |
| ----------------------------------------------------------- | -------------------------------------------------- |
| Pre-created wallet, 45 days old, artificial tx history      | Brand new wallet, zero history                     |
| Score appears pre-loaded — judges may question authenticity | Score starts at 0, built live on stage             |
| Shows an existing Stellar user getting a loan               | Shows a first-time user — the actual target market |
| Requires demo wallet setup before the presentation          | Entire flow including OTP email is live            |

### 9.2 Updated 60-Second Demo Script

| Second | Action                                                                              | What Judges See                                  |
| ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| 0–8    | "This is Maria. Zero wallet history. Score: 0/100." Open app, log in.               | Dashboard, Tier 0, Onboarding prompt             |
| 8–16   | Click "Start Verification." Step 1 loads. Click "Send Code."                        | Email send confirmation                          |
| 16–26  | Open email inbox (visible on second monitor or phone). Copy 6-digit code. Enter it. | Email in inbox with OTP, "Email verified ✓"      |
| 26–36  | Step 2: declare ₱18k income, business owner. Step 3: check permit + brgy cert.      | Live score preview rising: 0 → 30 → 40           |
| 36–44  | Click "Submit." Score reveal animation.                                             | 40/100 → Tier 1 → "Credit Approved"              |
| 44–54  | Click "Borrow ₱5,000." Confirm.                                                     | PHPC disbursement, tx hash                       |
| 54–60  | Open Stellar Expert.                                                                | SBT visible, non-transferable. PHPC transferred. |

**Demo tip:** Use two browser windows side by side — the Kredito app on the left, the email inbox on the right. The moment the email arrives with the OTP is the most human moment in the entire demo. Judges who are not Web3-native will instantly understand: _"Oh — it's like a normal app."_

---

## 10. V2 Upgrade Path

These are out of scope for the hackathon MVP but should be mentioned explicitly in the demo pitch:

| Feature                                       | What It Replaces         | Technical Path                                                                                                         |
| --------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Philippine SIM OTP** (Semaphore/Globe Labs) | Email OTP                | Change one env var + one service file. Scoring weight stays at 15 pts. Label changes to "Philippine number confirmed." |
| PhilSys eKYC                                  | Email/phone verification | Trulioo or IDWise API. Increases verification factor from 15 pts to 30 pts. Unlocks Tier 2 for first-time users.       |
| GCash transaction history                     | Declared income band     | GCash Open Finance API (under BSP framework, not yet public).                                                          |
| DTI permit number lookup                      | Business permit checkbox | DTI public registry API or OCR on uploaded permit image.                                                               |
| BSP-regulated credit data                     | All bootstrap factors    | Formal CIC accreditation — institutional path.                                                                         |

The bootstrap layer is explicitly designed to be replaced factor by factor. The scoring formula weights are configurable in the backend — upgrading from checkbox to verified document is a backend change only. Zero smart contract changes required at any stage.

---

## 11. Judging Alignment

| Judge Question                                            | Answer                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Why email and not phone?"                                | SMS has no genuinely free tier viable for real users — Twilio trial only messages pre-verified numbers. Resend's permanent free tier (3,000 emails/month) covers the entire hackathon at zero cost. On mainnet, the upgrade path to Philippine SIM verification is one environment variable change and one service file update — no contract changes, no scoring formula changes. |
| "What if someone lies on the form?"                       | The loan amount (₱5,000) is calibrated below the cost of fraud. Default results in permanent on-chain blacklisting. Email verification filters bots. The bootstrap score alone only reaches Tier 1 — the lowest risk tier.                                                                                                                                                        |
| "Is this actually decentralized?"                         | The bootstrap layer is centralized — the backend is a trusted attester. The on-chain layer is fully trustless. The system is explicit about this distinction. Over time, users migrate from the centralized layer to the trustless layer automatically as their repayment history grows.                                                                                          |
| "How is this different from just giving everyone a loan?" | Tier 0 users get nothing. Tier 1 requires 40 points. Not everyone qualifies on their first submission — the gap analysis shows them exactly what's missing.                                                                                                                                                                                                                       |
| "What's the mainnet path?"                                | Replace Resend with Semaphore PH for SIM-verified identity. Replace income declaration with GCash Open Finance API when it becomes available. Replace checkboxes with OCR document verification. The SBT contracts require zero changes.                                                                                                                                          |
