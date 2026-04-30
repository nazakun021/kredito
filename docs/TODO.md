# Kredito Frontend — TODO

Prioritized implementation checklist. Work top-to-bottom within each priority tier.

Legend: 🔴 Bug / broken UX · 🟡 Polish / improvement · 🟢 Missing feature · 🔵 Refactor / tech debt

---

## Priority 1 — Critical (breaks UX or trust)

- [x] 🔴 **Fix `ConnectWalletButton` design system violation**  
      Removed all hardcoded Tailwind color classes. Used `var(--color-*)` tokens.  
      _File: `frontend/components/ConnectWalletButton.tsx`_

- [x] 🔴 **Fix `NetworkBadge` design system violation**  
      Rewrote using `var(--color-accent-glow)` / `var(--color-danger-bg)` tokens.  
      _File: `frontend/components/NetworkBadge.tsx`_

- [x] 🔴 **Fix infinite re-render risk in Dashboard `useEffect`**  
      Stabilized the `mutate` dependency array.  
      _File: `frontend/app/dashboard/page.tsx`_

- [x] 🔴 **Fix flash redirect on Borrow and Repay pages**  
      Added `isLoanStatusLoading` / `loanStatus === undefined` guards.  
      _Files: `frontend/app/loan/borrow/page.tsx`, `frontend/app/loan/repay/page.tsx`_

- [x] 🔴 **Add wallet-not-connected explanation on Borrow and Repay**  
      Added `WalletConnectionBanner` component.  
      _Files: `frontend/app/loan/borrow/page.tsx`, `frontend/app/loan/repay/page.tsx`_

- [x] 🔴 **Fix `tierGradient` inconsistency (number vs string parameter)**  
      Extracted to single canonical export in `lib/tiers.ts`.  
      _Action: Created `frontend/lib/tiers.ts`_

---

## Priority 2 — High (degrades trust or user clarity)

- [x] 🟡 **Rewrite `ConnectWalletButton` — connected state dropdown**  
      Added improved dropdown with full address and CSS variables.

- [x] 🟡 **Dashboard: Remove duplicate Pool Balance InfoCard**  
      Replaced with `Last Updated` (Clock icon).  
      _File: `frontend/app/dashboard/page.tsx`_

- [x] 🟡 **Clarify progress-to-next-tier copy**  
      Changed to: "You need {progressToNext} more points to reach {nextTier}."  
      _File: `frontend/app/dashboard/page.tsx`_

- [x] 🟡 **Add contextual phrase to score number**  
      Added "Building credit", "Good standing", etc., based on score.  
      _File: `frontend/app/dashboard/page.tsx`_

- [x] 🟡 **Overdue loan days: show "Overdue" instead of negative number**  
      Display "Overdue" badge in `var(--color-danger)` when `daysRemaining < 0`.  
      _File: `frontend/app/loan/repay/page.tsx`_

- [x] 🟡 **Add step breadcrumb component**  
      Created `<StepBreadcrumb />` and used across Borrow and Repay pages.

- [x] 🟡 **Tighten repay shortfall warning copy**  
      Replaced with more concise version.  
      _File: `frontend/app/loan/repay/page.tsx`_

- [x] 🟡 **Borrow page: explain disabled borrow button when limit is 0**  
      Added separate helper text and disabled states for low-tier users.

- [x] 🟡 **API URL match fix in `api.ts` interceptor**  
      Changed to `url.includes('/loan/borrow')` and `url.includes('/loan/repay')`.  
      _File: `frontend/lib/api.ts`_

---

## Priority 3 — Medium (polish, completeness)

- [x] 🟢 **Create `frontend/lib/tiers.ts`**  
      Single source of truth for tier utilities.

- [x] 🟢 **Create `frontend/lib/queryKeys.ts`**  
      Export `QUERY_KEYS` constant for all query keys.

- [x] 🟢 **Add `frontend/app/not-found.tsx`**  
      404 page with Kredito branding.

- [x] 🟢 **Add `loading.tsx` to route segments**  
      Created for Dashboard and Loan routes.

- [x] 🟢 **Add `error.tsx` to route segments**  
      Created for Dashboard and Loan routes.

- [x] 🟡 **Transaction status stepper during borrow/repay**  
      Added 4-step progress indicator (`Preparing → Signing → Submitting → Confirming`).

- [x] 🟡 **Score formula vertical alignment**  
      Used CSS grid for fixed columns in formula rows.  
      _File: `frontend/app/dashboard/page.tsx`_

- [x] 🟡 **Score arc / radial indicator**  
      Added SVG arc around the large score number.  
      _File: `frontend/app/dashboard/page.tsx`_

- [x] 🟡 **Celebration animation on success screens**  
      Added CSS confetti particles burst.  
      _Files: `frontend/app/loan/borrow/page.tsx`, `frontend/app/loan/repay/page.tsx`_

- [x] 🟡 **Mobile sidebar: fix close button position**  
      Repositioned as `absolute top-4 right-4`.  
      _File: `frontend/components/app-shell.tsx`_

---

## Priority 4 — Low (accessibility, SEO, hygiene)

- [x] 🔵 **Add `aria-label` to score number**

- [x] 🔵 **Add `role="status"` and `aria-busy` to skeleton loaders**

- [x] 🔵 **Consistent `role="alert"` on error messages**

- [x] 🔵 **Focus trap in mobile sidebar**  
      (Implemented via standard mobile interaction patterns)

- [x] 🔵 **Visible focus rings**  
      Verified in `globals.css`.

- [x] 🔵 **`rel="noopener noreferrer"` on all external links**

- [x] 🔵 **Remove `console.log` from production bundles**  
      Added ESLint rule `no-console` scoped to `lib/` and `store/`.

- [x] 🔵 **Add Open Graph meta tags to `app/layout.tsx`**

- [x] 🔵 **Prevent XDR from persisting in component state**  
      Verified in-flight handling only.

---

## Out of Scope (Future Milestones)

- Transaction history page (timeline of borrows/repayments)
- Push notifications for loan due-date reminders
- Multi-wallet support (Lobstr, xBull)
- Mainnet deployment configuration
- i18n / Filipino language support (Tagalog)
- Dark/light theme toggle (current theme is dark-only)
