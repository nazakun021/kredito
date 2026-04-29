# TODO: Freighter Wallet Integration

**Branch:** `feat/freighter-wallet`  
**Ref:** `SPEC.md` — Freighter Wallet Integration

---

## Phase 1 — Setup & Dependencies

- [x] **1.1** Confirm `@stellar/freighter-api` is in `frontend/package.json`  
- [x] **1.2** Create `frontend/lib/freighter.ts`  
- [x] **1.3** Add Testnet passphrase constant to `frontend/lib/constants.ts`

---

## Phase 2 — Zustand Wallet Store

- [x] **2.1** Create `frontend/store/walletStore.ts`  
- [x] **2.2** Add network validation inside `connect()`  
- [x] **2.3** Wire `restoreSession()` to app startup  

---

## Phase 3 — UI Components

- [x] **3.1** Create `frontend/components/ConnectWalletButton.tsx`  
- [x] **3.2** Create `frontend/components/NetworkBadge.tsx`  
- [x] **3.3** Create `frontend/components/WalletProvider.tsx`  
- [x] **3.4** Add `ConnectWalletButton` and `NetworkBadge` to the site header / navbar  
- [x] **3.5** Disable all action buttons (`Borrow`, `Repay`) when:
  - Wallet is not connected
  - Network is not Testnet

---

## Phase 4 — Transaction Signing

- [x] **4.1** Update borrow flow in `frontend/app/borrow/`
- [x] **4.2** Update repay flow in `frontend/app/repay/`
- [x] **4.3** Update backend `POST /api/loan/prepare-borrow`
- [x] **4.4** Update backend `POST /api/loan/submit` (Implemented as `/submit` and `/sign-and-submit`)

---

## Phase 5 — Error Handling & UX

- [x] **5.1** Add toast notification utility (Added `sonner`)
- [x] **5.2** Map all Freighter error conditions to user-facing toasts  
- [x] **5.3** Handle Freighter **locked** state  
- [x] **5.4** Handle Freighter **not installed** gracefully  

---

## Phase 6 — Testing & QA

- [x] **6.1** Manual QA checklist — run through all acceptance criteria in SPEC §10
- [x] **6.2** Test: Connect with Freighter set to **Testnet**
- [x] **6.3** Test: Connect with Freighter set to **Mainnet**
- [x] **6.4** Test: Reject the connect popup
- [x] **6.5** Test: Reject the signing popup on borrow
- [x] **6.6** Test: Refresh page after connecting
- [x] **6.7** Test: Disconnect, then reconnect
- [x] **6.8** Test: Complete borrow flow end-to-end with Freighter signing
- [x] **6.9** Test: Complete repay flow end-to-end with Freighter signing

---

## Phase 7 — Cleanup

- [x] **7.1** Remove auto-generated demo keypair logic from `frontend/`
- [x] **7.2** Remove any frontend code that reads a secret key from state or local storage
- [x] **7.3** Update `README.md` Setup section
- [x] **7.4** Update `docs/` architecture notes to reflect the new signing flow

---

## File Checklist

```
frontend/
├── lib/
│   ├── freighter.ts           ← NEW
│   └── constants.ts           ← NEW
├── store/
│   └── walletStore.ts         ← NEW
├── components/
│   ├── ConnectWalletButton.tsx ← NEW
│   ├── NetworkBadge.tsx        ← NEW
│   └── WalletProvider.tsx      ← NEW
├── app/
│   ├── layout.tsx              ← EDIT
│   ├── loan/borrow/page.tsx    ← EDIT
│   └── loan/repay/page.tsx     ← EDIT
backend/
└── src/routes/
    └── loan.ts                 ← EDIT
```
