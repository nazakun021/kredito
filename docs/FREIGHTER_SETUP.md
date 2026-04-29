Here’s a **comprehensive, production-grade `SPEC.md`** that makes **Freighter** the primary authentication system for **Kredito**.

---

# SPEC.md — Kredito Freighter Authentication System

### SEA Stellar Hackathon · Track: Payments & Financial Access

### Version 1.0 | Last Updated: 2026-04-29

### Source of Truth: This document defines Freighter-based authentication for Kredito

---

# 1. 🎯 Objective

Replace traditional login (email/password) with **wallet-based authentication** using Freighter.

Kredito will:

- Use **Stellar public key as the primary user identity**
- Require **cryptographic proof of ownership via signature**
- Maintain **secure backend sessions (JWT/cookies)**

---

# 2. 🧱 System Overview

## 2.1 Architecture

```
Frontend (React / Next.js)
    ↓
Freighter API (Browser Extension)
    ↓
Backend (Auth Service)
    ↓
Database (User + Session)
```

---

## 2.2 Identity Model

| Concept        | Implementation      |
| -------------- | ------------------- |
| User ID        | Stellar Public Key  |
| Authentication | Signed Challenge    |
| Session        | JWT / Secure Cookie |
| Wallet         | Freighter           |

---

# 3. 🔐 Authentication Flow

## 3.1 Login Flow (Canonical)

```
1. User clicks "Login with Freighter"
2. Frontend calls getPublicKey()
3. Backend generates nonce (challenge)
4. Frontend asks user to sign challenge
5. Backend verifies signature
6. Session issued (JWT)
```

---

## 3.2 Sequence Diagram

```
User → Frontend → Freighter → Backend → DB
```

Detailed:

1. User initiates login
2. Frontend requests public key
3. Backend issues challenge
4. User signs challenge
5. Backend verifies signature
6. Backend creates/retrieves user
7. Backend issues session

---

# 4. 🧩 Frontend Specification

## 4.1 Dependencies

```bash
npm install @stellar/freighter-api
```

---

## 4.2 Freighter Detection

```js
if (!window.freighterApi) {
  throw new Error("Freighter not installed");
}
```

---

## 4.3 Login Implementation

```js
import { getPublicKey, signMessage } from "@stellar/freighter-api";

export async function login() {
  // Step 1: Get public key
  const publicKey = await getPublicKey();

  // Step 2: Request challenge
  const res = await fetch("/api/auth/challenge", {
    method: "POST",
    body: JSON.stringify({ publicKey }),
  });

  const { challenge } = await res.json();

  // Step 3: Sign challenge
  const signed = await signMessage(challenge);

  // Step 4: Verify
  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({
      publicKey,
      challenge,
      signed,
    }),
  });

  return verifyRes.json();
}
```

---

## 4.4 UX Requirements

- Show wallet connect prompt
- Handle rejection gracefully
- Display shortened address (e.g. `GABC...XYZ`)
- Persist login state

---

# 5. 🧠 Backend Specification

## 5.1 Tech Requirements

- Node.js (Express / Fastify) OR Go / Rust
- Stellar SDK for signature verification
- JWT library

---

## 5.2 API Endpoints

### POST `/api/auth/challenge`

**Request**

```json
{
  "publicKey": "GABC123..."
}
```

**Response**

```json
{
  "challenge": "random_nonce_string"
}
```

---

### POST `/api/auth/verify`

**Request**

```json
{
  "publicKey": "GABC123...",
  "challenge": "nonce",
  "signed": "signature"
}
```

**Response**

```json
{
  "token": "jwt_token",
  "user": {
    "publicKey": "GABC123..."
  }
}
```

---

## 5.3 Challenge Requirements

- Must be:
  - Unique per request
  - Expire in ≤ 5 minutes
  - Stored temporarily (Redis recommended)

Example:

```js
challenge = `Kredito Login: ${nonce} @ ${timestamp}`;
```

---

## 5.4 Signature Verification

Backend must:

1. Decode signature
2. Verify against:
   - Challenge message
   - Public key

Reject if:

- Signature invalid
- Challenge expired
- Public key mismatch

---

## 5.5 Session Management

- Issue JWT:

```json
{
  "sub": "stellar_public_key",
  "iat": "...",
  "exp": "..."
}
```

- Store session:
  - HTTP-only cookies (recommended)
  - OR Bearer token

---

# 6. 🗄️ Database Schema

## 6.1 Users Table

```sql
users (
  id UUID PRIMARY KEY,
  public_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP,
  last_login TIMESTAMP
)
```

---

## 6.2 Sessions (Optional)

```sql
sessions (
  id UUID,
  user_id UUID,
  token TEXT,
  expires_at TIMESTAMP
)
```

---

# 7. 🔒 Security Model

## 7.1 Core Guarantees

- Only wallet owner can authenticate
- No passwords stored
- Replay attacks prevented via nonce

---

## 7.2 Threat Model

| Threat            | Mitigation                         |
| ----------------- | ---------------------------------- |
| Replay attack     | Expiring nonce                     |
| Signature forgery | Stellar cryptographic verification |
| Phishing          | Clear signing message              |
| Session hijack    | HTTP-only cookies                  |

---

## 7.3 Signing Message Format

```text
Kredito Login Request
Nonce: <random>
Issued At: <timestamp>
Domain: kredito.app
```

---

# 8. 🌐 Network Configuration

| Environment | Network                |
| ----------- | ---------------------- |
| Dev         | Stellar Testnet        |
| Prod        | Stellar Public Network |

Ensure:

- Freighter network matches backend
- Reject mismatches

---

# 9. ⚡ Transaction Integration (Future)

Freighter can also:

- Sign loan agreements
- Sign repayment transactions
- Authorize escrow flows

---

# 10. 🧩 Extensibility

## 10.1 Multi-Factor Identity (Optional)

Combine with:

- Phone number (OTP)
- Email
- Government ID

---

## 10.2 Account Recovery

Since wallets are non-recoverable:

- Offer optional backup identity layer

---

# 11. 🚨 Failure Handling

| Case                   | Behavior       |
| ---------------------- | -------------- |
| User rejects signature | Show retry     |
| Freighter missing      | Prompt install |
| Invalid signature      | Deny login     |
| Expired challenge      | Restart flow   |

---

# 12. 🧪 Testing Plan

## 12.1 Unit Tests

- Signature verification
- JWT issuance
- Challenge expiry

## 12.2 Integration Tests

- Full login flow
- Wallet switching
- Network mismatch

---

# 13. 📦 Deployment Requirements

- HTTPS required
- Secure cookies enabled
- CORS configured
- Rate limiting on auth endpoints

---

# 14. 🏁 Success Criteria

Kredito is considered compliant when:

- ✅ Users can login using Freighter only
- ✅ No password-based login exists
- ✅ All sessions tied to verified signatures
- ✅ Public key is canonical identity

---

# 15. 🔮 Future Enhancements

- WalletConnect support (mobile wallets)
- Multi-chain identity abstraction
- On-chain identity reputation

---

If you want next step, I can:

- Turn this into a **drop-in Next.js + Express auth module**
- Or directly integrate it into your **Kredito repo structure** with routes, middleware, and hooks ready to go
