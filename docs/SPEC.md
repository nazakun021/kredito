# Kredito Frontend — Production UI/UX Specification

> **Version:** 1.0  
> **Scope:** `frontend/` — Next.js 16 / React 19 app  
> **Goal:** Elevate from functional prototype to production-grade, trust-inspiring financial dApp

---

## 1. Design System

### 1.1 CSS Variable Contract

All components **must** reference the established CSS variable tokens. No raw Tailwind color utilities (e.g. `bg-emerald-600`, `bg-slate-800`) are permitted in component files.

| Token                    | Role                               |
| ------------------------ | ---------------------------------- |
| `--color-bg-primary`     | Page background                    |
| `--color-bg-secondary`   | Sidebar / panel background         |
| `--color-bg-card`        | Inset card / code block background |
| `--color-bg-elevated`    | Elevated surface (hover, active)   |
| `--color-border`         | Default border                     |
| `--color-border-accent`  | Accent-colored border              |
| `--color-text-primary`   | Body text                          |
| `--color-text-secondary` | Subdued text                       |
| `--color-text-muted`     | Captions, labels                   |
| `--color-accent`         | Brand green (interactive)          |
| `--color-accent-glow`    | Low-opacity accent fill            |
| `--color-success`        | Positive / success                 |
| `--color-success-bg`     | Success surface                    |
| `--color-danger`         | Error / destructive                |
| `--color-danger-bg`      | Error surface                      |
| `--color-amber`          | Warning text                       |
| `--shadow-card`          | Card box-shadow                    |

**Critical violations found today:**

- `ConnectWalletButton.tsx` — uses `bg-emerald-600`, `bg-slate-800`, `border-slate-700`, `text-emerald-500` throughout. These override the dark theme with off-brand colors.
- `NetworkBadge.tsx` — uses `bg-yellow-100 text-yellow-800` (light-mode palette) which inverts the dark theme entirely.

Both components must be rewritten to use CSS variables exclusively.

### 1.2 Typography Scale

| Class / Usage        | Size                                    | Weight                        |
| -------------------- | --------------------------------------- | ----------------------------- |
| Page title (`h1`)    | `text-2xl` / `text-3xl`                 | `font-extrabold`              |
| Section heading      | `text-sm`                               | `font-bold`                   |
| Label / caption      | `text-[10px]` tracking-widest uppercase | `font-semibold`               |
| Body                 | `text-sm`                               | `font-normal`                 |
| Monospace data       | `font-mono text-sm`                     | —                             |
| Large number display | `text-5xl` / `text-6xl`                 | `font-extrabold tabular-nums` |

No ad-hoc font sizes outside this scale.

### 1.3 Spacing & Radius

- Card padding: `p-5` or `p-6`
- Card radius: `rounded-2xl`
- Button radius: `rounded-xl`
- Badge radius: `rounded-lg` (small) / `rounded-full` (network pill)
- Page max-width: `max-w-6xl` (dashboard), `max-w-4xl` (borrow), `max-w-lg` (repay / success)
- Section gap: `gap-5`

---

## 2. Component Specifications

### 2.1 ConnectWalletButton

**Current state:** Uses hardcoded Tailwind classes that clash with the dark design system.

**Required redesign:**

```
States:
  not-installed  → "Install Freighter ↗" link, uses --color-accent
  disconnected   → "Connect Wallet" button, btn-primary btn-accent style
  connecting     → spinner + "Connecting..." text, disabled
  connected      → truncated address dropdown (btn-dark style)
    dropdown:
      - Full address (monospace, truncated center)
      - "Disconnect" option (--color-danger text)
```

All colors via CSS variables. No raw Tailwind color utilities.

### 2.2 NetworkBadge

**Current state:** Uses light-mode Tailwind colors that invert the dark theme.

**Required redesign:**

```
correct network  → pill using --color-accent-glow bg, --color-accent text, --color-border-accent border
wrong network    → pill using --color-danger-bg bg, --color-danger text
```

The badge should render inside the header with proper dark-mode contrast.

### 2.3 Wallet Connection State Banner

A new component needed across all authenticated pages. When `walletConnected === false` on pages that require signing (Borrow, Repay), show an inline warning:

```
"⚠ Wallet not connected — connect Freighter to continue."
```

Currently the Borrow and Repay buttons silently disable with no explanation for users who haven't connected their wallet after logging in.

### 2.4 AppShell

**Issues:**

- Header `h1` title is hidden on mobile (intentional) but the page context is lost on small screens
- Mobile close button `X` is positioned in-flow inside the sidebar panel with no visual separation

**Spec:**

- Mobile header should show the current route name below the Kredito wordmark, or in the center of the header bar
- Sidebar close `X` on mobile should be an absolutely positioned button in the top-right corner of the drawer, not in-flow content

### 2.5 Score Card (Dashboard)

The credit score number should be contextualized. A raw number like `42` communicates nothing to a first-time user.

**Required additions:**

- A thin radial or arc progress indicator around the score number (SVG or CSS `conic-gradient`) showing position within the 0–850 range
- A contextual phrase below the number: e.g. "Building credit" (0–200), "On track" (201–400), "Good standing" (401–650), "Excellent" (651+)
- Tier badge color must match tier number, not tier label — currently `tierGradient` takes a `number` in dashboard and a `string` in repay. Consolidate to a single utility function exported from `lib/tiers.ts`.

### 2.6 Borrow Confirmation Flow

A single checkbox before a financial transaction is insufficient for a production financial app.

**Required UX:**

- Replace the checkbox with a 2-step confirmation:
  1. Review card showing Approved Amount, Fee, Total Owed, Due Date
  2. Confirmation row with checkbox ("I confirm I want to borrow P{amount}")
  3. CTA button only becomes active after checkbox is checked AND wallet is connected AND correct network
- When any blocker is unmet, show a specific inline pill explaining the blocker (not just a disabled button):
  - "Connect your wallet first"
  - "Switch Freighter to Testnet"
  - "Check the box to confirm"

### 2.7 Transaction Pending State

Currently, during `handleBorrow` and `handleRepay`, only a spinner on the button indicates loading. For a blockchain transaction:

**Required additions:**

- A full-width status bar (or bottom toast) with step progression:
  `Preparing → Requesting signature → Submitting to Stellar → Confirming...`
- The button should lock the entire form, not just itself, to prevent double-submission

### 2.8 Empty States

Define dedicated empty state visuals for:

| State                          | Display                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| Score not generated            | Icon + "No credit data yet" + "Generate your Credit Passport" CTA |
| Pool empty                     | Icon + "Pool is currently empty" + description                    |
| No active loan (on Repay page) | Redirect is correct; no empty state needed                        |

### 2.9 Error States

Errors currently appear as red boxes at the bottom of cards with no hierarchy.

**Spec:**

- API errors that are transient (network timeout, 5xx) → bottom toast via `sonner`, auto-dismiss after 5s
- API errors that are user-actionable (InsufficientBalance, tier too low) → inline error card near the CTA with a specific fix message
- 401 session expiry → full-page session expired screen (not a silent redirect)

---

## 3. Page Specifications

### 3.1 Landing Page (`/`)

The landing page is not included in uploaded files but is critical for the user journey. It must:

- Explain the product in ≤ 3 sentences visible above the fold
- Include a single CTA: "Connect Wallet to Start"
- Show the testnet disclaimer prominently so demo judges understand the context
- Display the 4-step product flow (Connect → Score → Borrow → Repay) as a visual stepper

### 3.2 Dashboard (`/dashboard`)

**Layout:** 5-column grid (3 left, 2 right) is correct. No structural changes needed.

**Issues to fix:**

- `InfoCard` at the bottom shows `Pool: P{balance}` which duplicates the Pool Status card above. Replace one of the InfoCards with "Score Last Refreshed" (timestamp).
- `progressToNext` label shows raw point count ("125 pts") but the description says "Progress to Gold" — clarify with a sentence: "You need 125 more points to reach Gold"
- Formula display uses template strings; make the `=` column vertically aligned using CSS `grid` columns instead of `<p>` tags

**Loading strategy:** Current `isLoading` is calculated as:

```ts
(scoreQuery.isLoading && !scoreQuery.data) || generateMutation.isPending;
```

This is correct but the condition in the `useEffect` that triggers `generateMutation` has a dependency array bug — `generateMutation` object changes reference every render, risking an infinite loop. See §5.1.

### 3.3 Borrow Page (`/loan/borrow`)

**Issues to fix:**

- The redirect `router.replace('/loan/repay')` on `loanStatus?.hasActiveLoan` fires immediately, before `loanStatus` has loaded. This causes a flash redirect for ~500ms. Guard with `loanStatus !== undefined`.
- "Step 3" label is hardcoded. Abstract into a `<StepBreadcrumb step={3} total={4} />` component that can be reused across the flow.
- `borrowAmount <= 0` disables the borrow button, but no message explains why. Show "Your borrow limit is 0 — keep transacting to build credit."

### 3.4 Repay Page (`/loan/repay`)

**Issues to fix:**

- Same `loanStatus !== undefined` guard needed for redirect
- Shortfall warning text is wordy. Tighten to: "Your wallet needs P{shortfall} more PHPC to cover the fee. Top up before repaying."
- Days remaining display: negative days should show "Overdue" badge, not a negative number

### 3.5 Success Screens

Both borrow and repay success screens use the same structure. They should:

- Include a confetti / particle burst animation (CSS or lightweight canvas) on first render to celebrate the milestone — this reinforces the "Credit Passport" leveling-up narrative
- The "View on Stellar Expert" link should open in a new tab with `rel="noreferrer noopener"` (repay page already does this; verify borrow page matches)

### 3.6 404 Page

Missing. Create `frontend/app/not-found.tsx` with:

- Kredito branding
- "Page not found" message
- "Back to Dashboard" link

---

## 4. State Management

### 4.1 Auth Store (`store/auth`)

No changes to interface needed. Ensure `clearAuth()` also clears `walletStore` (currently done in `handleLogout` — confirm this is the only exit point).

### 4.2 Wallet Store (`store/walletStore`)

The uploaded files don't include `walletStore.ts`. Based on usage in other files, the store must expose:

- `isConnected: boolean`
- `publicKey: string | null`
- `network: string | null`
- `isConnecting: boolean`
- `connectionError: string | null`
- `connect(): Promise<void>`
- `disconnect(): void`
- `restoreSession(): Promise<void>`

The `restoreSession` function (called by `WalletProvider`) should not show a visible spinner — it's a background reconnect. Ensure it handles the case where Freighter is not installed gracefully (no thrown errors).

### 4.3 Query Keys

Standardize query keys as constants in `lib/queryKeys.ts`:

```ts
export const QUERY_KEYS = {
  score: (wallet: string) => ["score", wallet],
  pool: ["pool"],
  loanStatus: ["loan-status"],
} as const;
```

Prevents typo mismatches between query registration and invalidation calls.

---

## 5. Bug Log

### 5.1 Infinite Re-render Risk — Dashboard

```ts
// Current (BUGGY):
useEffect(() => {
  if (scoreQuery.isError && !generateMutation.isPending && ...) {
    generateMutation.mutate();
  }
}, [scoreQuery.isError, generateMutation]); // ← generateMutation changes every render

// Fix:
const mutate = generateMutation.mutate; // stable ref
useEffect(() => {
  if (scoreQuery.isError && !generateMutation.isPending && ...) {
    mutate();
  }
}, [scoreQuery.isError, generateMutation.isPending, generateMutation.data, generateMutation.isError, mutate]);
```

### 5.2 Flash Redirect — Borrow & Repay

```ts
// Current (BUGGY):
useEffect(() => {
  if (loanStatus?.hasActiveLoan) { router.replace('/loan/repay'); }
}, [loanStatus?.hasActiveLoan, ...]);

// Fix — guard against undefined (loading state):
useEffect(() => {
  if (loanStatus === undefined) return; // still loading
  if (loanStatus.hasActiveLoan) { router.replace('/loan/repay'); }
}, [loanStatus, ...]);
```

### 5.3 Inconsistent `tierGradient` Signature

Dashboard calls `tierGradient(tier: number)`. Repay page defines its own `tierGradient(tierLabel: string)`. These produce different gradients for the same tier. Extract to `lib/tiers.ts` with a single canonical function:

```ts
export function tierGradient(tier: number): string { ... }
export function tierLabel(tier: number): string { ... }
```

### 5.4 Missing Wallet Connection Warning on Borrow/Repay

If `walletConnected === false`, the CTA button is disabled but no message explains why. A user who has logged in (auth token exists) but hasn't connected their Freighter wallet will see a disabled button with no explanation.

### 5.5 Duplicate Pool Balance — Dashboard InfoCards

The bottom-left `InfoCard` shows `Pool: P{poolBalance}` which is already shown in the Pool Status card above. This wastes space and creates redundancy.

---

## 6. Accessibility

- All interactive elements must have visible focus rings (`outline: 2px solid var(--color-accent)`)
- Skeleton loaders must include `aria-busy="true"` and `role="status"` on their container
- Score number should use `aria-label="Credit score: {score}"` on the `<h2>`
- Error alerts must use `role="alert"` (already done in borrow page — ensure consistent)
- The mobile sidebar drawer must trap focus while open (`focus-trap-react` or manual implementation)
- Network badge color changes must not rely on color alone — include text ("Testnet ✓", "Wrong Network ✗")

---

## 7. Performance

- Add `loading.tsx` to `app/dashboard/`, `app/loan/borrow/`, and `app/loan/repay/` to enable React Suspense streaming
- Add `error.tsx` to the same routes for graceful error boundaries instead of uncaught render errors
- `WalletProvider` `restoreSession()` call happens on mount — debounce or lock to prevent multiple simultaneous calls if the component is remounted
- All TanStack Query `staleTime` values are appropriate; no changes needed

---

## 8. Security

- The `api.ts` interceptor that handles `requiresSignature` reads `url.endsWith('loan/borrow')` — if the base URL ever ends with a `/`, this check will silently fail. Use `url.includes('/loan/borrow')` instead.
- Never log `token`, `publicKey`, or transaction XDR to the browser console in production. Add an ESLint rule to flag `console.log` in `lib/` and `store/` directories.
- The `signTx` in `freighter.ts` returns `signedXdr` which is then sent to the backend. Ensure the XDR is not logged or stored in component state longer than needed.
