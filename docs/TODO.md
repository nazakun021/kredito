# Mobile Responsiveness TODO

> **Will it break things?** No. All changes are purely additive Tailwind class swaps.
> The app already has a solid mobile foundation (the sidebar is already a drawer on mobile,
> most grids already stack on small screens). This is polish, not a rebuild.

---

## Priority: High (visible on first load)

### `frontend/app/page.tsx` — Landing Page

**1. Hero headline too large on small phones (375px)**

```diff
- <h1 className="mt-8 text-5xl font-extrabold leading-[1.1] tracking-tight lg:text-7xl">
+ <h1 className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-7xl">
```

**2. Hero section vertical padding is excessive on mobile**

```diff
- <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-center gap-12 py-16 lg:flex-row lg:items-center lg:gap-20">
+ <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-center gap-8 py-10 lg:flex-row lg:items-center lg:gap-20">
```

**3. Hero card — center it on mobile instead of left-aligning**

```diff
- <div className="w-full max-w-sm lg:max-w-none lg:flex-1 animate-fade-up" ...>
+ <div className="mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none lg:flex-1 animate-fade-up" ...>
```

**4. Nav — "Features / How it works" links hidden on mobile with no replacement**

Add a simple anchor row below the navbar that only shows on mobile:

```tsx
{
  /* Add this right after </nav>, before the hero section */
}
<div
  className="flex items-center justify-center gap-6 border-b py-2 text-xs font-medium sm:hidden"
  style={{
    borderColor: "var(--color-border)",
    color: "var(--color-text-muted)",
  }}
>
  <a href="#features" className="hover:text-white transition-colors">
    Features
  </a>
  <a href="#how-it-works" className="hover:text-white transition-colors">
    How it works
  </a>
</div>;
```

**5. "How Kredito works" heading too large on mobile**

```diff
- <h2 className="mt-4 text-4xl font-extrabold tracking-tight lg:text-5xl">
+ <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
```

---

## Priority: High (dashboard — core app screen)

### `frontend/app/dashboard/page.tsx`

**6. Last Updated / Wallet grid — fixed 2 columns regardless of screen size**

```diff
- <div className="grid grid-cols-2 gap-4 animate-fade-up">
+ <div className="grid grid-cols-2 gap-3 animate-fade-up">
```

_(The cards are small enough that 2-col is fine even on 375px — just tighten the gap.)_

**7. Score header — badge and score can overflow on narrow screens**

```diff
- <div className="flex items-start justify-between gap-4 relative z-10">
+ <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
```

**8. Score formula grid overflows on mobile**

The `grid-cols-[1fr_auto_1fr]` formula rows can be tight at 320px. Add horizontal scroll:

```diff
- <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 max-w-sm">
+ <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 max-w-sm overflow-x-auto text-sm">
```

**9. Dashboard page padding on mobile**

The outer wrapper doesn't have bottom padding — last card gets clipped:

```diff
- <div className="space-y-5 animate-fade-up">   {/* or whatever the root wrapper is */}
+ <div className="space-y-5 animate-fade-up pb-6">
```

---

## Priority: Medium (borrow / repay flows)

### `frontend/app/loan/borrow/page.tsx`

**10. Approved amount price text clips on small screens**

```diff
- <p className="mt-4 text-5xl font-extrabold tabular-nums">P{borrowAmount.toFixed(2)}</p>
+ <p className="mt-4 text-4xl font-extrabold tabular-nums sm:text-5xl">P{borrowAmount.toFixed(2)}</p>
```

**11. TransactionStepper bars too wide for small screens**

Each step bar is `w-12` (48px). With 4 steps and `justify-between`, this works down to ~260px but is tight. Make the bars fluid:

```diff
- className={`h-1.5 w-12 rounded-full transition-all duration-500 ...`}
+ className={`h-1.5 w-8 sm:w-12 rounded-full transition-all duration-500 ...`}
```

**12. Step label text too small to read at `text-[9px]`**

```diff
- <span className="text-[9px] font-bold uppercase tracking-tighter" ...>
+ <span className="text-[10px] font-bold uppercase tracking-wide" ...>
```

### `frontend/app/loan/repay/page.tsx`

**13. Check for any fixed-width containers — none found, repay page is already single-column ✅**

---

## Priority: Low (polish)

### `frontend/components/ConnectWalletButton.tsx`

**14. Dropdown can overflow viewport on very small screens**

```diff
- className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl ..."
+ className="absolute right-0 mt-2 w-52 sm:w-56 overflow-hidden rounded-xl ..."
```

### `frontend/components/WalletConnectionBanner.tsx`

**15. Banner wraps awkwardly on mobile — allow text to wrap**

```diff
- <div className="flex items-center justify-between gap-4 p-4 rounded-xl border ...">
+ <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border ...">
```

---

## After making changes — Screenshots to take

Once all changes are deployed, take these 3 screenshots on a 390px viewport
(iPhone 14 size in Chrome DevTools):

1. `images/mobile-landing.png` — Hero page
2. `images/mobile-dashboard.png` — Dashboard with score loaded
3. `images/mobile-borrow.png` — Borrow flow (review step)

Add them to `README.md` under the **📱 Mobile Responsive** section.

---

## What will NOT break

- All sidebar/drawer logic is already in `app-shell.tsx` and works on mobile (`lg:hidden` hamburger, slide-in drawer) — do not touch this.
- All API calls, auth flows, Zustand state, and Freighter integration are unaffected.
- All grid layouts already use `lg:grid-cols-*` so they stack correctly on mobile — the changes above are purely typographic and spacing tweaks.
