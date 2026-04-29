# SPEC: Freighter Wallet Integration

**Project:** Kredito — Uncollateralized micro-lending on Stellar Soroban  
**Feature:** Real Freighter wallet connect flow (replaces demo auto-generated keypair)  
**Target:** `frontend/` (Next.js 16 / React 19 / Zustand)
**Status:** IMPLEMENTED (2026-04-29)

---

## 1. Overview

Currently, Kredito's demo entry point auto-generates a funded test keypair on the backend and injects it silently. This spec defines the integration of the **Freighter browser extension** (`@stellar/freighter-api`) as the primary wallet provider, so users authenticate with their own non-custodial Stellar wallet instead of a server-managed keypair.

When a user clicks **"Connect Wallet"**, the Freighter extension popup must open, request access, and return the user's public key. All subsequent transactions (borrow, repay) must be signed by Freighter rather than by a backend-held secret key.

---

## 2. Scope

| In Scope                      | Out of Scope                       |
| ----------------------------- | ---------------------------------- |
| Freighter install detection   | Mobile wallet support              |
| `requestAccess` connect flow  | WalletConnect / other wallets      |
| Wallet state in Zustand store | Backend keypair generation removal |
| Network guard (Testnet only)  | Mainnet deployment config          |
| Freighter-signed borrow tx    | Fee-bump sponsorship changes       |
| Freighter-signed repay tx     | Smart contract changes             |
| Disconnect / session clear    | Multi-wallet abstraction layer     |
| Reconnect on page refresh     | OAuth / social login               |

---

## 3. Dependencies

```
@stellar/freighter-api   ^3.x    # Wallet connection & signing API
```

> Already listed as a prerequisite in the project README. Confirm it is installed in `frontend/package.json`.

---

## 4. Freighter API Reference

### 4.1 Detection

```ts
import { isConnected } from "@stellar/freighter-api";

const { isConnected: hasExtension } = await isConnected();
// true  → extension is installed
// false → show "Install Freighter" CTA
```

### 4.2 Connect (triggers popup)

```ts
import { requestAccess } from "@stellar/freighter-api";

const result = await requestAccess();
if (result.error) throw new Error(result.error);
const publicKey = result.address; // G... Stellar public key
```

> `requestAccess` opens the Freighter extension popup for first-time access. On subsequent visits, if the user has already granted access, it silently returns the public key.

### 4.3 Get Address (silent, no popup)

```ts
import { getAddress } from "@stellar/freighter-api";

const result = await getAddress();
if (result.error) return null;
return result.address;
```

Use this on page load to restore a previously connected session without re-prompting.

### 4.4 Network Detection

```ts
import { getNetworkDetails } from "@stellar/freighter-api";

const details = await getNetworkDetails();
// details.network         → "TESTNET" | "PUBLIC" | etc.
// details.networkPassphrase
// details.sorobanRpcUrl
```

Kredito must enforce **Testnet only**. If the user's Freighter is on a different network, show an error banner and block interaction.

### 4.5 Sign Transaction

```ts
import { signTransaction } from "@stellar/freighter-api";

const { signedTxXdr, error } = await signTransaction(unsignedXdr, {
  networkPassphrase: "Test SDF Network ; September 2015",
  address: publicKey,
});
```

> Calling `signTransaction` opens the Freighter popup for the user to review and approve the transaction. On approval it returns `signedTxXdr`.

---

## 5. State Model

### 5.1 Zustand Wallet Store — `frontend/store/walletStore.ts`

```ts
interface WalletState {
  // connection
  isConnected: boolean;
  publicKey: string | null;
  network: string | null; // "TESTNET" | "PUBLIC" | null
  networkPassphrase: string | null;

  // ui
  isConnecting: boolean;
  connectionError: string | null;

  // actions
  connect: () => Promise<void>;
  disconnect: () => void;
  restoreSession: () => Promise<void>;
}
```

### 5.2 State Transitions

```
IDLE
  │  user clicks "Connect"
  ▼
CONNECTING (isConnecting = true)
  │  requestAccess() called → Freighter popup opens
  ├─ success ──► CONNECTED (publicKey set, network validated)
  └─ error   ──► IDLE + connectionError set

CONNECTED
  │  user clicks "Disconnect"
  ▼
IDLE (publicKey = null, isConnected = false)

PAGE LOAD
  │  restoreSession() → getAddress() called silently
  ├─ address returned  ──► CONNECTED (no popup)
  └─ empty / error     ──► IDLE
```

---

## 6. Component Specifications

### 6.1 `ConnectWalletButton`

**Location:** `frontend/components/ConnectWalletButton.tsx`

**Behavior:**

| State                   | Button Label                      | Action on Click                          |
| ----------------------- | --------------------------------- | ---------------------------------------- |
| Extension not installed | `Install Freighter ↗`             | Opens `https://freighter.app` in new tab |
| Idle / disconnected     | `Connect Wallet`                  | Calls `walletStore.connect()`            |
| Connecting              | `Connecting…` (disabled, spinner) | No-op                                    |
| Connected               | `G...XXXX ▾` (truncated address)  | Opens disconnect dropdown                |

**Truncation format:** First 4 + `...` + last 4 characters of the public key.  
Example: `GAJQ...W3VE`

### 6.2 `NetworkBadge`

**Location:** `frontend/components/NetworkBadge.tsx`

Shown adjacent to the connect button when wallet is connected.

| Network | Badge               | Color  |
| ------- | ------------------- | ------ |
| TESTNET | `Testnet`           | Yellow |
| PUBLIC  | `⚠ Wrong Network`   | Red    |
| Other   | `⚠ Unknown Network` | Red    |

When badge is red, all borrow/repay action buttons must be **disabled**.

### 6.3 `WalletProvider` (Context / Session Restoration)

**Location:** `frontend/components/WalletProvider.tsx`

Wraps the app and calls `restoreSession()` on mount so a returning user's wallet is silently re-connected without clicking the button again.

---

## 7. Transaction Signing Flow

Replaces the current backend-signed transaction approach for borrow and repay.

### 7.1 Borrow Flow (updated)

```
1. Frontend builds unsigned borrow XDR (using @stellar/stellar-sdk)
       └─ source account = freighter publicKey
       └─ operation: lending_pool.borrow(amount)
2. Backend receives XDR for fee-bump sponsorship
       └─ POST /api/loan/prepare-borrow { xdr, borrower }
       └─ Returns fee-bumped XDR (unsigned inner tx)
3. Frontend calls signTransaction(feeBumpedXdr, { networkPassphrase, address })
       └─ Freighter popup opens for user approval
4. On approval, frontend submits signedXdr to backend
       └─ POST /api/loan/submit { signedXdr }
5. Backend submits to Soroban RPC and returns tx hash
```

### 7.2 Repay Flow (updated)

Same pattern as borrow — frontend builds the repay XDR, backend wraps it in a fee bump, Freighter signs it, backend submits.

---

## 8. Error Handling

| Error Condition            | User-Facing Message                                    |
| -------------------------- | ------------------------------------------------------ |
| Freighter not installed    | `"Please install the Freighter extension to connect."` |
| User rejected access       | `"Connection cancelled. Please try again."`            |
| Wrong network in Freighter | `"Switch Freighter to Testnet to continue."`           |
| User rejected signing      | `"Transaction signing was cancelled."`                 |
| Freighter locked           | `"Freighter is locked. Please unlock your wallet."`    |
| RPC submission failure     | `"Transaction failed to submit. Please try again."`    |

All errors should appear as **toast notifications** (non-blocking) using the existing UI notification system.

---

## 9. Security Considerations

- **Never** send or log the user's private key — Freighter signs client-side only.
- The backend must **not** need the user's secret key for borrow/repay after this change.
- Always validate `networkPassphrase` matches Testnet before submitting.
- The `address` parameter in `signTransaction` must match the connected `publicKey` in store to prevent account-switching attacks.

---

## 10. Acceptance Criteria

- [ ] Clicking "Connect Wallet" on a machine **with** Freighter installed opens the Freighter popup.
- [ ] Clicking "Connect Wallet" on a machine **without** Freighter shows an install link.
- [ ] After connecting, the header displays the truncated public key.
- [ ] On page refresh, a previously connected wallet is silently restored (no popup).
- [ ] Clicking "Disconnect" clears wallet state and returns to idle.
- [ ] If Freighter is set to Mainnet, a red "⚠ Wrong Network" badge appears and action buttons are disabled.
- [ ] Clicking "Borrow" or "Repay" opens the Freighter signing popup.
- [ ] Rejecting the signing popup shows a toast error and does not proceed.
- [ ] Successful transaction submission shows a toast with the transaction hash.
