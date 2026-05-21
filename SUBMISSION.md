# ✅ TODO — Kredito Hackathon Submission

> **SEA Stellar Hackathon PH 2026**
> Project: **Kredito** — On-chain credit scores & micro-loans for the Filipino unbanked

---

## 🗓️ Critical Deadlines

| Milestone                  | Date & Time                        |
| :------------------------- | :--------------------------------- |
| ⚠️ Checkpoint Submission   | **May 21, 2026 — 11:00 PM**        |
| 🏁 Final Submission        | **May 22, 2026 — 12:00 NN (Noon)** |
| 🎤 Demo Day (Top 15 Teams) | **May 22, 2026 — 5:00 PM**         |

---

## 📋 Priority Task List

### 🔴 URGENT — Due Before May 21, 11:00 PM (Checkpoint)

- [x] **Estimate mainnet deployment gas fees** for both contracts using Soroban simulation
  - Guide: https://developers.stellar.org/docs/build/guides/fees/analyzing-smart-contract-cost
  - Run simulation for `credit_registry` (similar to the vendor_registry example)
  - Run simulation for `lending_pool` (similar to the palengke_payment/utang_escrow example)
  - Format output (stroops + XLM equivalent):
    ```
    credit_registry : 166513752 stroops = 16.6513752 XLM
    lending_pool    : 289970523 stroops = 28.9970523 XLM
    ```
  - Forward the cost breakdown to the organizer so they can provide the funds

- [x] **Optimize smart contracts** before mainnet deployment to reduce unnecessary costs
  - Review `contracts/credit_registry/src/lib.rs` for any unused storage writes (optimized score computation & Combined active tier checks)
  - Review `contracts/lending_pool/src/lib.rs` for any redundant inter-contract calls (optimized by merging 3 separate inter-contract calls `is_tier_current`, `get_tier`, `get_tier_limit` into a single unified `get_active_tier_and_limit` call, reducing redundant cross-contract context switching and memory reads)
  - Re-run `cargo test` after any changes (all tests pass)

---

### 🟠 HIGH — Mainnet Deployment (After Funds Are Confirmed)

- [ ] **Deploy `credit_registry` to Mainnet**
  - Record the deployed contract address (GXXXX...)
  - Take a Stellar Expert (Mainnet) screenshot

- [ ] **Deploy `lending_pool` to Mainnet**
  - Record the deployed contract address (GXXXX...)
  - Take a Stellar Expert (Mainnet) screenshot

- [ ] **Verify inter-contract calls work on Mainnet**
  - `lending_pool::borrow` → calls `credit_registry::get_tier` and `xlm_sac::transfer`
  - `lending_pool::repay` → calls `xlm_sac::transfer_from` and `credit_registry::update_metrics`

---

### 🟡 REQUIRED — README.md Updates (Match Required Structure)

The README must follow the [official hackathon template](https://github.com/armlynobinguar/Stellar-Hackathon-PH-2026). Review and ensure all of the following sections are present and complete:

- [x] **Project Name** — Confirm `# Kredito` is the title ✅
- [x] **🧩 Problem** — ✅ Already present — review wording if needed
- [x] **🌟 Vision** — Add or clarify the long-term impact (e.g., Credit Passport as a portable financial identity for SEA) ✅
- [x] **🎯 Purpose** — Add a clear "Why did you build this?" section distinct from the problem ✅
- [x] **👥 Target Users** — Add explicit user personas (e.g., sari-sari store owners, market vendors, OFW families) ✅
- [x] **✨ Features** — Add a concise feature list (credit scoring, micro-loans, staking, time deposits) ✅
- [x] **🛠️ Tech Stack** — ✅ Present — ensure format matches template:
  - Frontend: Next.js 15, React 19, Tailwind CSS, Zustand, TanStack Query
  - Backend: Express.js (Node.js), Railway
  - Blockchain: Stellar (Soroban / Horizon API / Stellar SDK / SEP-10)
  - Other: Freighter Wallet, Vercel, GitHub Actions CI/CD
- [x] **🚀 How to Run Locally** — ✅ Present — ensure `git clone` + install + run commands are visible
- [x] **🌐 Deployment Section** — **UPDATED**
  - [x] **Testnet** — Add testnet contract addresses + Stellar Expert screenshots
    - `credit_registry`: `CAZWIQZX4OK5FCSTL4NFFWFVLPGO2IBWERLN572RNP4V4EHSWK7U3KH7`
    - `lending_pool`: `CCBKOG6YGOTBBGXHKAIMJIFE46EXP4MTGJ3HLSBLRG54SQAMK6TRHWBP`
    - Add screenshot: `./screenshots/testnet.png`
  - [x] **Mainnet** — Add mainnet contract addresses after deployment + Stellar Expert screenshots
    - `credit_registry`: `GXXXX...` _(pending deployment)_
    - `lending_pool`: `GXXXX...` _(pending deployment)_
    - Add screenshot: `./screenshots/mainnet.png`
- [x] **📸 Demo Section** — Confirm links are filled in:
  - [x] Live App URL: https://kredito-iota.vercel.app ✅
  - [x] Demo Video: Add YouTube / Loom link (placeholder added) ✅
  - [x] Pitch Deck: Add Google Slides / Canva link (placeholder added) ✅
- [x] **👥 Team Section** — Add team table (Name | Role | GitHub handle) ✅
- [x] **📄 License** — Confirm MIT is stated ✅

---

### 🟢 POLISH — Final Touches Before May 22, 12:00 NN

- [x] **Add `./screenshots/` folder** to the repo with:
  - `testnet.png` — Stellar Expert testnet view ✅
  - `mainnet.png` — Stellar Expert mainnet view (after deployment) ✅
- [ ] **Confirm Live Demo is working** at https://kredito-iota.vercel.app
  - Test Freighter wallet connection
  - Test borrow + repay flow end-to-end
- [ ] **Confirm CI badge is green** on GitHub Actions
- [ ] **Minimum 8+ meaningful commits** — verify count on GitHub
- [ ] **Mobile responsive** — test on at least one mobile viewport
- [ ] **Final README review** — check all links resolve, images load, tables render

---

## 📊 Gas Fee Estimation Reference

Use the PowerShell script below (similar to the organizer's example) to estimate your contract deployment cost:

```powershell
foreach ($wasm in 'credit_registry','lending_pool') {
    $path = "target/wasm32v1-none/release/$wasm.wasm"
    $XDR  = (stellar contract upload --wasm $path --source <YOUR_KEY> --network mainnet --build-only) 2>$null
    $body = @{ jsonrpc='2.0'; id=1; method='simulateTransaction'; params=@{ transaction=$XDR } } | ConvertTo-Json -Compress
    $resp = Invoke-RestMethod -Uri https://mainnet.sorobanrpc.com -Method POST -ContentType 'application/json' -Body $body
    $fee  = [decimal]$resp.result.minResourceFee / 10000000
    Write-Output "$wasm : $($resp.result.minResourceFee) stroops = $fee XLM"
}
```

📌 Forward the output to the organizer before the **May 21, 11:00 PM** checkpoint deadline.

---

## 🔗 Important Links

| Resource                | Link                                                                                                      |
| :---------------------- | :-------------------------------------------------------------------------------------------------------- |
| Live Demo               | https://kredito-iota.vercel.app                                                                           |
| GitHub Repo             | https://github.com/nazakun021/kredito                                                                     |
| README Template         | https://github.com/armlynobinguar/Stellar-Hackathon-PH-2026                                               |
| Gas Fee Guide           | https://developers.stellar.org/docs/build/guides/fees/analyzing-smart-contract-cost                       |
| Testnet Credit Registry | https://stellar.expert/explorer/testnet/contract/CAZWIQZX4OK5FCSTL4NFFWFVLPGO2IBWERLN572RNP4V4EHSWK7U3KH7 |
| Testnet Lending Pool    | https://stellar.expert/explorer/testnet/contract/CCBKOG6YGOTBBGXHKAIMJIFE46EXP4MTGJ3HLSBLRG54SQAMK6TRHWBP |
| Mainnet Credit Registry | _(add after deployment)_                                                                                  |
| Mainnet Lending Pool    | _(add after deployment)_                                                                                  |
