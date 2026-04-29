# TODO.md — Kredito Final Polish

### Response to DevRel Feedback · Last Updated: 2026-04-29

### Priority: Complete all 🔴 items before replying to the DevRel email.

---

## DevRel Checklist — Direct Response

| DevRel Request                               | Status                                         | Action       |
| -------------------------------------------- | ---------------------------------------------- | ------------ |
| Frontend fully polished and production-ready | ⚠️ Landing done, full flow unverified          | Phase 1      |
| Finalize and clearly document README         | ✅ Links block + track statement + demo flow   | —            |
| Add deployed smart contract links            | ✅ Done — Stellar Expert + screenshots         | —            |
| Include live deployment link                 | ✅ Added to README Links section               | —            |
| Update About section                         | ✅ Has Vercel URL                              | Minor polish |
| Improve repo organization                    | ✅ .env.example, deployed.json, docs/README.md | —            |

---

## Legend

```
[ ]  Not started
[x]  Done
🔴   Blocking — reply to DevRel cannot go out without this
🟡   Important — strengthens submission
🟢   Polish — nice to have
```

---

## Phase 1 — Verify the Full Demo Loop is Actually Working 🔴

### Estimated time: 1–2 hours

### Do this FIRST. Everything else is cosmetic if the demo breaks on click.

- [ ] 🔴 Open `https://kredito-iota.vercel.app` in a fresh incognito window
- [ ] 🔴 Click "Generate Score →" — confirm it navigates to `/dashboard` within 2–3 seconds
- [ ] 🔴 Confirm dashboard shows a real score (not a loading spinner that never resolves)
- [ ] 🔴 Confirm the formula card shows real substituted values (not placeholders like `{txCount}`)
- [ ] 🔴 Confirm pool balance is visible and non-zero
- [ ] 🔴 Click "Borrow" — confirm borrow page loads with real tier limit amount
- [ ] 🔴 Confirm borrow transaction succeeds — tx hash appears, Explorer link works
- [ ] 🔴 Confirm repay page loads with correct loan details
- [ ] 🔴 Confirm repay transaction succeeds — score refreshes after
- [ ] 🔴 Open the Stellar Expert link that appears after borrow — confirm PHPC transfer is visible on-chain

**If any step above fails:**

- [ ] 🔴 Check Railway backend logs for errors
- [ ] 🔴 Verify Railway `.env` has correct contract IDs matching the README:
  ```
  REGISTRY_ID=CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ
  LENDING_POOL_ID=CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH
  PHPC_ID=CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR
  ```
- [ ] 🔴 Verify Vercel `NEXT_PUBLIC_API_URL` points to the live Railway URL (not localhost)
- [ ] 🔴 Verify CORS on backend allows the Vercel origin

---

## Phase 2 — README Polish (Direct DevRel Response) 🔴

### Estimated time: 30 minutes

### 2.1 Add Live Demo Link to README Top 🔴

- [x] Add this block immediately after the repo title and one-liner, before "Problem": ✅ Done

### 2.2 Add Demo Video Link 🟡

- [ ] Record a 2-minute Loom video of the full working demo:
  - 0:00–0:10 — problem narration (Maria, loan shark, no credit history)
  - 0:10–1:10 — live 4-screen demo loop (Generate → Score → Borrow → Repay)
  - 1:10–2:00 — Stellar Expert showing Credit Passport on-chain + PHPC transfer
- [ ] Upload to Loom (unlisted OK)
- [ ] Add Loom URL to the Links block in README

### 2.3 Tighten the Demo Flow Section 🟡

- [x] Changed "Demo Flow (2 minutes)" to match the actual 4-screen flow exactly ✅ Done
- [x] Removed "Enter Demo" as a step ✅ Done

### 2.4 Add Track Statement 🟡

- [x] Added track statement above "Problem" ✅ Done

### 2.5 Verify Contract IDs Are Consistent 🔴

- [ ] Confirm the three IDs in README match exactly what's in Railway `.env`
- [ ] The README currently shows a DIFFERENT `lending_pool` ID than earlier deploy.sh output:
  - README: `CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH`
  - Earlier deploy.sh: `CAEHZ3HYAVH4DTDM4UX6TNZU35ME4V5WQ5TBDXRKJ43QLXGHYANFKLVV`
- [ ] Run this to confirm which one is live and funded:
  ```bash
  stellar contract invoke \
    --id CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH \
    --network testnet -- get_pool_balance
  ```
- [ ] Update README to only contain the verified live IDs

---

## Phase 3 — Repository Organization & Presentation 🟡

### Estimated time: 45 minutes

### 3.1 Add `.env.example` to Backend 🟡

Judges will try to run this locally. Without `.env.example`, they can't.

- [x] `backend/.env.example` expanded with all variables and real contract IDs ✅ Done
- [ ] Add `backend/.env.example` to git and commit

### 3.2 Add `contracts/deployed.json` 🟡

- [x] `contracts/deployed.json` already exists with canonical IDs ✅ Done
- [x] Removed `deployed.json` from `.gitignore` so it is tracked ✅ Done
- [x] Commit to repo

### 3.3 Update GitHub Repository About Section 🟡

In the GitHub repo sidebar (Settings → About):

- [x] Description: `Transparent on-chain credit scores and instant micro-loans for the Filipino unbanked. Built on Stellar Soroban.`
- [x] Website: `https://kredito-iota.vercel.app`
- [x] Topics: add `stellar`, `soroban`, `defi`, `philippines`, `micro-lending`, `web3`, `blockchain`
- [x] Check "Include in home page" for Packages/Deployments if available

### 3.4 Verify .gitignore is Correct 🔴

- [x] Confirm `.env` files are NOT committed to the repo:
  ```bash
  git log --all --full-history -- "**/.env"
  # Should return nothing
  ```
- [x] Confirm `node_modules/` is not committed
- [x] Confirm `target/` (Rust build artifacts) is not committed
- [x] If any secrets are in git history: rotate them immediately, then use `git filter-repo` to purge

---

## Phase 5 — Backup Demo Preparation 🟡

### In case live demo has issues during judge evaluation

- [ ] Take 4 screenshots — one per demo screen — and add to `images/` folder:
  - `images/screen1-landing.png`
  - `images/screen2-dashboard.png`
  - `images/screen3-borrow.png`
  - `images/screen4-repay.png`
- [ ] Save backup screenshots locally in case Vercel has downtime during review

---

## What Does NOT Need to Be Done Right Now 🟢

(Backlog — only if you have spare time after Phase 1–4)

- [ ] Freighter wallet connection (nice to have — landing page "Get Freighter" link is sufficient)
- [ ] Mobile PWA manifest
- [ ] Default loan demo scenario
- [ ] Score history chart
- [ ] Animated score counter
