const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

function getSlideImagePath(num) {
  const tmpPath = `/tmp/kredito_slide-0${num}.jpg`;
  if (fs.existsSync(tmpPath)) return tmpPath;
  const localPath = path.join(__dirname, "images", `${num}.png`);
  if (fs.existsSync(localPath)) return localPath;
  return tmpPath; // fallback
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
const { FaShieldAlt, FaCoins, FaChartLine, FaUsers, FaLock, FaCheckCircle,
        FaRocket, FaGlobe, FaBolt, FaMoneyBillWave, FaLayerGroup, FaHandshake,
        FaArrowRight, FaStar } = require("react-icons/fa");

async function iconPng(IconComp, color = "#FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComp, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  darkBg:    "0A0F1E",   // deep navy
  cardBg:    "111827",   // card background
  cardBg2:   "1A2235",   // slightly lighter card
  green:     "22C55E",   // brand green (matches Kredito UI)
  greenDark: "16A34A",
  white:     "FFFFFF",
  gray:      "94A3B8",
  lightGray: "CBD5E1",
  accent:    "38BDF8",   // sky blue accent
  gold:      "F59E0B",
  darkCard:  "0D1929",
};

// ── Reusable helpers ──────────────────────────────────────────────────────────
function darkCard(slide, x, y, w, h) {
  slide.addShape("rect", { x, y, w, h,
    fill: { color: C.cardBg2 },
    shadow: { type: "outer", color: "000000", blur: 14, offset: 4, angle: 135, opacity: 0.25 },
    line: { color: "1E3A5F", width: 0.5 }
  });
}

function sectionLabel(slide, text) {
  slide.addText(text.toUpperCase(), {
    x: 0.5, y: 0.22, w: 9, h: 0.28,
    fontSize: 9, color: C.green, bold: true, align: "left",
    charSpacing: 3, margin: 0
  });
}

function slideTitle(slide, text, y = 0.6) {
  slide.addText(text, {
    x: 0.5, y, w: 9, h: 0.7,
    fontSize: 32, color: C.white, bold: true, fontFace: "Calibri", margin: 0
  });
}

// ── Build deck ────────────────────────────────────────────────────────────────
async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Kredito Pitch Deck";
  pres.author = "Tirso Benedict Naza";

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 1 — Cover
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };

    // Green accent left bar
    s.addShape("rect", { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.green }, line: { color: C.green } });

    // Stellar badge top-right
    s.addText("BUILT ON STELLAR", {
      x: 7.2, y: 0.3, w: 2.6, h: 0.35,
      fontSize: 9, color: C.green, bold: true, align: "right",
      charSpacing: 2, margin: 0
    });

    // Big title
    s.addText("Kredito.", {
      x: 0.55, y: 1.3, w: 8, h: 1.5,
      fontSize: 80, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Tagline
    s.addText("Decentralized Microfinance\nfor the Underbanked", {
      x: 0.55, y: 2.9, w: 7, h: 1.0,
      fontSize: 20, color: C.lightGray, bold: false, fontFace: "Calibri", margin: 0
    });

    // Green pill
    s.addShape("roundRect", { x: 0.55, y: 4.0, w: 3.4, h: 0.42,
      fill: { color: C.green }, line: { color: C.green }, rectRadius: 0.05 });
    s.addText("Blockchain-Powered Credit Passport", {
      x: 0.55, y: 4.0, w: 3.4, h: 0.42,
      fontSize: 10, color: C.darkBg, bold: true, align: "center", margin: 0
    });

    // Presenter
    s.addText("Presented by  Tirso Benedict Naza", {
      x: 0.55, y: 5.1, w: 6, h: 0.3,
      fontSize: 11, color: C.gray, margin: 0
    });

    // Right decorative circle
    s.addShape("ellipse", { x: 7.8, y: 0.5, w: 3.5, h: 3.5,
      fill: { color: C.green, transparency: 90 }, line: { color: C.green, width: 0.5, transparency: 70 }
    });
    s.addShape("ellipse", { x: 8.4, y: 1.2, w: 2.2, h: 2.2,
      fill: { color: C.green, transparency: 80 }, line: { color: C.green, width: 0.5, transparency: 50 }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 2 — The Problem
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "The Problem");

    s.addText("Financial Access in the Philippines Is Still Broken", {
      x: 0.5, y: 0.55, w: 9, h: 0.85,
      fontSize: 28, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Big stat cards — row
    const stats = [
      { val: "44%+", label: "of Filipinos\nunderbanked" },
      { val: "₱300B+", label: "informal lending\nmarket (PH)" },
      { val: "5–10×", label: "higher rates from\nloan sharks" },
    ];
    stats.forEach((st, i) => {
      const x = 0.5 + i * 3.1;
      darkCard(s, x, 1.55, 2.85, 1.5);
      s.addText(st.val, { x, y: 1.62, w: 2.85, h: 0.7, fontSize: 34, color: C.green, bold: true, align: "center", margin: 0 });
      s.addText(st.label, { x, y: 2.3, w: 2.85, h: 0.65, fontSize: 11, color: C.lightGray, align: "center", margin: 0 });
    });

    // Pain points
    s.addText("Why people stay unbanked:", {
      x: 0.5, y: 3.25, w: 9, h: 0.3, fontSize: 12, color: C.green, bold: true, margin: 0
    });

    const pains = [
      "Traditional banks require formal credit history — most Filipinos have none",
      "Small vendors, freelancers, and gig workers are excluded from fair loan access",
      "High-interest informal lending traps vulnerable borrowers in debt cycles",
      "Financial systems ignore users without traditional banking relationships",
    ];
    s.addText(pains.map(p => ({ text: p, options: { bullet: true, breakLine: true, paraSpaceAfter: 4 } }))
      .map((item, idx) => idx < pains.length - 1 ? item : { ...item, options: { ...item.options, breakLine: false } }),
    {
      x: 0.5, y: 3.6, w: 9, h: 1.7,
      fontSize: 13, color: C.lightGray, margin: 0
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 3 — The Solution
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "The Solution");

    s.addText("Kredito: A Portable On-Chain\nCredit Identity", {
      x: 0.5, y: 0.55, w: 5.5, h: 1.1,
      fontSize: 28, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Right tagline box
    darkCard(s, 6.2, 0.45, 3.6, 1.2);
    s.addText('"Financial access should not require\ntraditional banking privilege."', {
      x: 6.3, y: 0.55, w: 3.4, h: 1.0,
      fontSize: 12, color: C.green, italic: true, align: "center", margin: 0
    });

    // 4 feature cards
    const features = [
      { icon: FaShieldAlt, title: "Credit Passport", desc: "On-chain identity built from real transaction behavior, not bank records" },
      { icon: FaCoins,     title: "Borrow XLM",     desc: "Instant loan disbursement to your Stellar wallet based on your tier" },
      { icon: FaChartLine, title: "Build Reputation",desc: "Repay on time → score improves → unlock higher limits and lower fees" },
      { icon: FaBolt,      title: "Stake & Earn",    desc: "Lenders, NGOs, and DAOs fund the pool and earn yield from loan fees" },
    ];

    for (let i = 0; i < 4; i++) {
      const x = 0.5 + (i % 2) * 4.75;
      const y = 1.85 + Math.floor(i / 2) * 1.55;
      darkCard(s, x, y, 4.5, 1.35);
      const ico = await iconPng(features[i].icon, "#22C55E", 256);
      s.addImage({ data: ico, x: x + 0.2, y: y + 0.25, w: 0.45, h: 0.45 });
      s.addText(features[i].title, { x: x + 0.8, y: y + 0.18, w: 3.5, h: 0.35, fontSize: 14, color: C.white, bold: true, margin: 0 });
      s.addText(features[i].desc, { x: x + 0.8, y: y + 0.55, w: 3.5, h: 0.65, fontSize: 11, color: C.gray, margin: 0 });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 4 — Market Opportunity (NEW)
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Market Opportunity");

    s.addText("A Massive Underserved Market", {
      x: 0.5, y: 0.55, w: 9, h: 0.7,
      fontSize: 30, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // TAM / SAM / SOM funnel visually
    const markets = [
      { label: "TAM", title: "Global Microfinance", val: "$300B+", sub: "Worldwide unbanked population: 1.4B", color: C.accent, w: 8.5 },
      { label: "SAM", title: "Southeast Asia Fintech", val: "$38B", sub: "Digital lending market by 2025, growing 25% YoY", color: C.green, w: 6.5 },
      { label: "SOM", title: "Philippines Underbanked", val: "$2.4B", sub: "50M+ unbanked Filipinos × avg. micro-loan need", color: C.gold, w: 4.5 },
    ];

    markets.forEach((m, i) => {
      const y = 1.5 + i * 1.2;
      const x = (10 - m.w) / 2;
      s.addShape("rect", { x, y, w: m.w, h: 0.95,
        fill: { color: m.color, transparency: 85 },
        line: { color: m.color, width: 1 }
      });
      s.addText(m.label, { x: x + 0.15, y: y + 0.12, w: 0.6, h: 0.4, fontSize: 11, color: m.color, bold: true, margin: 0 });
      s.addText(m.title, { x: x + 0.85, y: y + 0.08, w: m.w - 2.5, h: 0.32, fontSize: 13, color: C.white, bold: true, margin: 0 });
      s.addText(m.sub, { x: x + 0.85, y: y + 0.42, w: m.w - 2.5, h: 0.35, fontSize: 10, color: C.gray, margin: 0 });
      s.addText(m.val, { x: x + m.w - 1.6, y: y + 0.12, w: 1.5, h: 0.55, fontSize: 20, color: m.color, bold: true, align: "right", margin: 0 });
    });

    // Bottom note
    s.addText("Kredito targets early adopters in the Philippines with a proven product before expanding across SE Asia.", {
      x: 0.5, y: 5.0, w: 9, h: 0.4,
      fontSize: 11, color: C.gray, italic: true, align: "center", margin: 0
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 5 — How It Works (visual flow)
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Architecture");

    s.addText("How Kredito Works", {
      x: 0.5, y: 0.55, w: 5, h: 0.65,
      fontSize: 30, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Flow: User → Next.js → Express API → Soroban Contracts → Stellar Mainnet
    const steps = [
      { label: "User\nWallet", color: C.green },
      { label: "Next.js\nFrontend", color: C.accent },
      { label: "Express\nBackend API", color: C.accent },
      { label: "Soroban\nSmart Contracts", color: C.gold },
      { label: "Stellar\nMainnet", color: C.green },
    ];

    const boxW = 1.55, boxH = 1.0, startX = 0.4, y = 1.5, gap = 0.35;
    steps.forEach((st, i) => {
      const x = startX + i * (boxW + gap);
      s.addShape("roundRect", { x, y, w: boxW, h: boxH,
        fill: { color: C.cardBg2 }, line: { color: st.color, width: 1.5 }, rectRadius: 0.06
      });
      s.addText(st.label, { x, y: y + 0.1, w: boxW, h: boxH - 0.2,
        fontSize: 11, color: C.white, bold: true, align: "center", valign: "middle", margin: 0
      });
      if (i < steps.length - 1) {
        s.addShape("line", {
          x: x + boxW, y: y + boxH / 2, w: gap, h: 0,
          line: { color: C.gray, width: 1.5 }
        });
        s.addText("→", { x: x + boxW, y: y + boxH / 2 - 0.15, w: gap, h: 0.3,
          fontSize: 12, color: C.gray, align: "center", margin: 0
        });
      }
    });

    // Smart contracts detail
    const contracts = [
      { name: "credit_registry", bullets: ["Stores borrower reputation", "Score tiers (Bronze → Diamond)", "Repayment behavior history", "KYC verification status"] },
      { name: "lending_pool", bullets: ["Handles borrow & repayment", "Manages staking liquidity", "Distributes fee rewards", "Enforces tier-based limits"] },
    ];

    contracts.forEach((c, i) => {
      const x = 0.5 + i * 4.75;
      darkCard(s, x, 2.8, 4.5, 2.55);
      s.addShape("rect", { x, y: 2.8, w: 4.5, h: 0.38,
        fill: { color: i === 0 ? C.green : C.gold, transparency: 20 }, line: { color: i === 0 ? C.green : C.gold, width: 0 }
      });
      s.addText(c.name, { x: x + 0.15, y: 2.82, w: 4.2, h: 0.35,
        fontSize: 12, color: C.darkBg, bold: true, fontFace: "Courier New", margin: 0
      });
      s.addText(c.bullets.map((b, bi) => ({
        text: b, options: { bullet: true, breakLine: bi < c.bullets.length - 1, paraSpaceAfter: 3 }
      })), { x: x + 0.15, y: 3.28, w: 4.2, h: 1.9, fontSize: 11, color: C.lightGray, margin: 0 });
    });

    // Tech stack pill
    s.addShape("roundRect", { x: 6.8, y: 0.6, w: 3.0, h: 0.65,
      fill: { color: C.cardBg2 }, line: { color: C.gray, width: 0.5 }, rectRadius: 0.05
    });
    s.addText("SEP-10 Auth  ·  Horizon API  ·  Stellar SDK", {
      x: 6.8, y: 0.6, w: 3.0, h: 0.65,
      fontSize: 9.5, color: C.gray, align: "center", valign: "middle", margin: 0
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 6 — Product: Dashboard + Credit Score
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Product");

    s.addText("Live Product — Credit Passport Dashboard", {
      x: 0.5, y: 0.55, w: 9, h: 0.6,
      fontSize: 26, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Screenshot placeholder card
    darkCard(s, 0.4, 1.28, 5.8, 3.8);
    s.addImage({ path: getSlideImagePath(5), x: 0.4, y: 1.28, w: 5.8, h: 3.8 });

    // Callout bullets right
    const callouts = [
      { title: "On-Chain Score", desc: "Score built from real Stellar transaction history — not bank records" },
      { title: "Credit Tiers", desc: "Bronze → Silver → Gold → Platinum → Diamond, each unlocking higher limits" },
      { title: "Instant Limits", desc: "Borrow limit and fee rate enforced directly via smart contract" },
      { title: "KYC Boost", desc: "Verified identity unlocks Diamond tier — highest limits, lowest fees" },
    ];

    callouts.forEach((c, i) => {
      const y = 1.3 + i * 0.92;
      s.addShape("rect", { x: 6.45, y: y + 0.05, w: 0.04, h: 0.7, fill: { color: C.green }, line: { color: C.green } });
      s.addText(c.title, { x: 6.65, y: y + 0.05, w: 3.1, h: 0.3, fontSize: 12, color: C.white, bold: true, margin: 0 });
      s.addText(c.desc, { x: 6.65, y: y + 0.36, w: 3.1, h: 0.5, fontSize: 10, color: C.gray, margin: 0 });
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 7 — Product: Lending Flow
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Product");

    s.addText("End-to-End Lending Flow", {
      x: 0.5, y: 0.55, w: 9, h: 0.6,
      fontSize: 26, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    darkCard(s, 0.4, 1.28, 5.8, 3.8);
    s.addImage({ path: getSlideImagePath(6), x: 0.4, y: 1.28, w: 5.8, h: 3.8 });

    const steps = [
      { num: "1", text: "Borrow — tier-gated eligibility enforced on-chain" },
      { num: "2", text: "Review & Confirm — transparent fee breakdown" },
      { num: "3", text: "Funds Released — instant disbursement to wallet" },
      { num: "4", text: "Repaid on Time — score updates, tier may advance" },
    ];

    steps.forEach((st, i) => {
      const y = 1.45 + i * 0.9;
      s.addShape("ellipse", { x: 6.45, y: y, w: 0.38, h: 0.38, fill: { color: C.green }, line: { color: C.green } });
      s.addText(st.num, { x: 6.45, y: y, w: 0.38, h: 0.38, fontSize: 13, color: C.darkBg, bold: true, align: "center", valign: "middle", margin: 0 });
      s.addText(st.text, { x: 7.0, y: y + 0.03, w: 2.75, h: 0.6, fontSize: 11, color: C.lightGray, margin: 0 });
    });

    s.addText("1.50% flat fee · 30-day term · No principal deduction", {
      x: 6.45, y: 5.05, w: 3.3, h: 0.35,
      fontSize: 10, color: C.green, bold: true, align: "center", margin: 0
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 8 — Product: Staking, Time Deposits, KYC
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Product");

    s.addText("For Lenders & Savers — Stake, Earn, Deposit", {
      x: 0.5, y: 0.55, w: 9, h: 0.6,
      fontSize: 26, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Two screenshots side by side
    darkCard(s, 0.4, 1.3, 4.5, 2.5);
    s.addImage({ path: getSlideImagePath(7), x: 0.4, y: 1.3, w: 4.5, h: 2.5 });

    darkCard(s, 5.1, 1.3, 4.5, 2.5);
    s.addImage({ path: getSlideImagePath(8), x: 5.1, y: 1.3, w: 4.5, h: 2.5 });

    s.addText("Stake & Earn", { x: 0.4, y: 3.85, w: 4.5, h: 0.3, fontSize: 12, color: C.green, bold: true, align: "center", margin: 0 });
    s.addText("Time Deposit & KYC Verification", { x: 5.1, y: 3.85, w: 4.5, h: 0.3, fontSize: 12, color: C.accent, bold: true, align: "center", margin: 0 });

    const descs = [
      { x: 0.4, text: "Stake XLM into the lending pool · Earn 50% of all loan fees · Unstake anytime" },
      { x: 5.1, text: "Lock XLM for fixed term · Guaranteed interest reserved at deposit · KYC unlocks Diamond tier" },
    ];
    descs.forEach(d => {
      s.addText(d.text, { x: d.x, y: 4.2, w: 4.5, h: 0.6, fontSize: 10, color: C.gray, align: "center", margin: 0 });
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 9 — Business Model (NEW)
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Business Model");

    s.addText("How Kredito Makes Money", {
      x: 0.5, y: 0.55, w: 9, h: 0.65,
      fontSize: 30, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Revenue streams
    const streams = [
      { icon: FaMoneyBillWave, color: C.green, title: "Loan Origination Fee", val: "1.50%", desc: "Flat fee collected on repayment (not deducted from principal). Scales with loan volume." },
      { icon: FaLayerGroup, color: C.accent, title: "Protocol Fee Share", val: "50%", desc: "50% of all loan fees go to the staking pool (lenders/NGOs/DAOs). 50% retained as protocol revenue." },
      { icon: FaStar, color: C.gold, title: "Time Deposit Spread", val: "~1%", desc: "Guaranteed interest offered to depositors is funded by pool yield; spread is protocol income." },
    ];

    for (let i = 0; i < 3; i++) {
      const x = 0.5 + i * 3.1;
      darkCard(s, x, 1.4, 2.85, 2.6);
      const ico = await iconPng(streams[i].icon, "#" + streams[i].color, 256);
      s.addImage({ data: ico, x: x + 1.15, y: 1.55, w: 0.55, h: 0.55 });
      s.addText(streams[i].val, { x, y: 2.18, w: 2.85, h: 0.55,
        fontSize: 30, color: streams[i].color, bold: true, align: "center", margin: 0
      });
      s.addText(streams[i].title, { x, y: 2.75, w: 2.85, h: 0.35,
        fontSize: 11, color: C.white, bold: true, align: "center", margin: 0
      });
      s.addText(streams[i].desc, { x: x + 0.1, y: 3.15, w: 2.65, h: 0.7,
        fontSize: 9.5, color: C.gray, align: "center", margin: 0
      });
    }

    // Unit economics note
    darkCard(s, 0.5, 4.15, 9.0, 1.1);
    s.addShape("rect", { x: 0.5, y: 4.15, w: 0.06, h: 1.1, fill: { color: C.green }, line: { color: C.green } });
    s.addText("Unit Economics Example", { x: 0.75, y: 4.2, w: 8.5, h: 0.28, fontSize: 11, color: C.green, bold: true, margin: 0 });
    s.addText("100 borrowers × avg. 20 XLM × 1.50% fee = 30 XLM/cycle · 50% to stakers · 50% protocol revenue · Scales with user growth and higher tier adoption.", {
      x: 0.75, y: 4.5, w: 8.5, h: 0.65, fontSize: 10.5, color: C.lightGray, margin: 0
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 10 — Traction & Build Status (NEW)
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Traction");

    s.addText("What's Been Built", {
      x: 0.5, y: 0.55, w: 9, h: 0.65,
      fontSize: 30, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    const milestones = [
      { done: true,  text: "Full Next.js + Express stack deployed" },
      { done: true,  text: "Soroban smart contracts: credit_registry + lending_pool" },
      { done: true,  text: "SEP-10 wallet authentication (Freighter/Lobstr support)" },
      { done: true,  text: "Credit scoring engine (Horizon API + on-chain data)" },
      { done: true,  text: "Borrow / Repay flow with instant XLM disbursement" },
      { done: true,  text: "Stake & Earn with real-time reward accumulation" },
      { done: true,  text: "Time Deposit with maturity enforcement + early withdrawal" },
      { done: true,  text: "KYC verification (Diamond tier unlock)" },
      { done: false, text: "Mainnet deployment & security audit" },
      { done: false, text: "GCash on-ramp integration" },
      { done: false, text: "Public beta launch (PH)" },
    ];

    const col1 = milestones.slice(0, 6);
    const col2 = milestones.slice(6);

    for (let col = 0; col < 2; col++) {
      const items = col === 0 ? col1 : col2;
      const xBase = 0.5 + col * 4.75;
      for (let i = 0; i < items.length; i++) {
        const m = items[i];
        const y = 1.42 + i * 0.56;
        const ico = await iconPng(FaCheckCircle, m.done ? "#22C55E" : "#334155", 128);
        s.addImage({ data: ico, x: xBase, y: y + 0.04, w: 0.3, h: 0.3 });
        s.addText(m.text, {
          x: xBase + 0.42, y: y, w: 4.0, h: 0.4,
          fontSize: 12, color: m.done ? C.white : C.gray, margin: 0
        });
      }
    }

    s.addText("✅  Fully functional on Stellar Testnet — ready for audit & mainnet deployment", {
      x: 0.5, y: 5.1, w: 9, h: 0.32,
      fontSize: 11, color: C.green, bold: true, align: "center", margin: 0
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 11 — Why Stellar
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Technology");

    s.addText("Why We Built on Stellar", {
      x: 0.5, y: 0.55, w: 9, h: 0.65,
      fontSize: 30, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    const reasons = [
      { icon: FaBolt,       color: C.green,  title: "Fast Finality",             val: "~5 sec",  desc: "Transactions settle in seconds — critical for real-world loan disbursement." },
      { icon: FaMoneyBillWave, color: C.accent, title: "Extremely Low Fees",     val: "< $0.001", desc: "Accessible even for micro-transactions in emerging markets." },
      { icon: FaUsers,      color: C.gold,   title: "Financial Inclusion",       val: "120M+",   desc: "Stellar's mission directly aligns: built for underserved communities." },
      { icon: FaLayerGroup, color: C.green,  title: "Soroban Smart Contracts",   val: "WASM",    desc: "Programmable, auditable contracts for trustless credit logic." },
      { icon: FaShieldAlt,  color: C.accent, title: "SEP Standards",             val: "SEP-10",  desc: "Wallet interoperability with Freighter, Lobstr, and others out of the box." },
      { icon: FaGlobe,      color: C.gold,   title: "Scalable Infrastructure",   val: "1,000 TPS", desc: "Production-ready for mass adoption without congestion." },
    ];

    for (let i = 0; i < 6; i++) {
      const x = 0.5 + (i % 3) * 3.15;
      const y = 1.45 + Math.floor(i / 3) * 1.7;
      darkCard(s, x, y, 2.9, 1.5);
      const ico = await iconPng(reasons[i].icon, "#" + reasons[i].color, 256);
      s.addImage({ data: ico, x: x + 0.18, y: y + 0.32, w: 0.45, h: 0.45 });
      s.addText(reasons[i].val, { x: x + 0.75, y: y + 0.15, w: 2.0, h: 0.35, fontSize: 18, color: reasons[i].color, bold: true, margin: 0 });
      s.addText(reasons[i].title, { x: x + 0.75, y: y + 0.5, w: 2.0, h: 0.28, fontSize: 10.5, color: C.white, bold: true, margin: 0 });
      s.addText(reasons[i].desc, { x: x + 0.15, y: y + 0.9, w: 2.65, h: 0.5, fontSize: 9, color: C.gray, margin: 0 });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 12 — Team (NEW)
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Team");

    s.addText("The Team Behind Kredito", {
      x: 0.5, y: 0.55, w: 9, h: 0.65,
      fontSize: 30, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Lead card
    darkCard(s, 0.5, 1.45, 4.3, 3.5);
    s.addShape("ellipse", { x: 1.55, y: 1.65, w: 1.5, h: 1.5, fill: { color: C.green, transparency: 20 }, line: { color: C.green, width: 1.5 } });
    s.addText("TBN", { x: 1.55, y: 1.65, w: 1.5, h: 1.5, fontSize: 24, color: C.white, bold: true, align: "center", valign: "middle", margin: 0 });
    s.addText("Tirso Benedict Naza", { x: 0.65, y: 3.28, w: 4.0, h: 0.38, fontSize: 15, color: C.white, bold: true, align: "center", margin: 0 });
    s.addText("Founder & Full-Stack Developer", { x: 0.65, y: 3.68, w: 4.0, h: 0.28, fontSize: 11, color: C.green, align: "center", margin: 0 });
    s.addText([
      { text: "Next.js · Node.js · Stellar/Soroban", options: { bullet: true, breakLine: true } },
      { text: "Designed and built the full Kredito platform", options: { bullet: true, breakLine: true } },
      { text: "Blockchain microfinance architecture", options: { bullet: true } },
    ], { x: 0.65, y: 4.0, w: 3.9, h: 0.9, fontSize: 10, color: C.gray, margin: 0 });

    // Vision card right
    darkCard(s, 5.1, 1.45, 4.4, 3.5);
    s.addShape("rect", { x: 5.1, y: 1.45, w: 4.4, h: 0.45, fill: { color: C.green, transparency: 20 }, line: { color: C.green, width: 0 } });
    s.addText("Mission-Driven Development", { x: 5.2, y: 1.5, w: 4.2, h: 0.38, fontSize: 12, color: C.green, bold: true, margin: 0 });
    s.addText("Kredito was built because the problem is real and personal — financial exclusion affects millions of Filipinos every day.\n\nEvery design decision — from on-chain credit identity to transparent fee structures — was made to protect borrowers, not extract from them.", {
      x: 5.2, y: 2.02, w: 4.2, h: 2.4,
      fontSize: 12, color: C.lightGray, margin: 0
    });

    s.addText("Actively seeking co-founders, advisors, and Stellar ecosystem partners.", {
      x: 5.2, y: 4.6, w: 4.2, h: 0.3, fontSize: 10, color: C.green, italic: true, margin: 0
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 13 — Roadmap
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "Roadmap");

    s.addText("The Path to Scale", {
      x: 0.5, y: 0.55, w: 9, h: 0.65,
      fontSize: 30, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    const phases = [
      { phase: "Phase 1", period: "Now → Q3 2026", color: C.green, items: ["Security audit & mainnet deployment", "Philippines beta launch", "50 early adopter borrowers", "NGO/DAO lender onboarding"] },
      { phase: "Phase 2", period: "Q4 2026 → Q1 2027", color: C.accent, items: ["GCash on-ramp integration", "Alternative Credit Identity sharing", "Merchant payment pilot", "500 active borrowers"] },
      { phase: "Phase 3", period: "2027+", color: C.gold, items: ["Southeast Asia expansion", "Stablecoin lending (USDC)", "B2B API for NGOs/cooperatives", "10,000+ credit passport holders"] },
    ];

    phases.forEach((ph, i) => {
      const x = 0.45 + i * 3.15;
      darkCard(s, x, 1.45, 2.95, 3.85);
      s.addShape("rect", { x, y: 1.45, w: 2.95, h: 0.45,
        fill: { color: ph.color, transparency: 20 }, line: { color: ph.color, width: 0 }
      });
      s.addText(ph.phase, { x: x + 0.12, y: 1.5, w: 1.4, h: 0.35, fontSize: 13, color: ph.color, bold: true, margin: 0 });
      s.addText(ph.period, { x: x + 0.12, y: 1.88, w: 2.75, h: 0.28, fontSize: 10, color: C.gray, margin: 0 });
      s.addText(ph.items.map((item, ii) => ({
        text: item, options: { bullet: true, breakLine: ii < ph.items.length - 1, paraSpaceAfter: 5 }
      })), { x: x + 0.12, y: 2.25, w: 2.75, h: 2.85, fontSize: 11, color: C.lightGray, margin: 0 });
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 14 — The Ask (NEW)
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };
    sectionLabel(s, "The Ask");

    s.addText("What We're Seeking from Stellar", {
      x: 0.5, y: 0.55, w: 9, h: 0.65,
      fontSize: 28, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    // Big green ask box
    s.addShape("roundRect", { x: 0.5, y: 1.38, w: 5.5, h: 1.4,
      fill: { color: C.green, transparency: 10 }, line: { color: C.green, width: 1.5 }, rectRadius: 0.08
    });
    s.addText("Stellar Community Fund (SCF)\nGrant Application", {
      x: 0.65, y: 1.5, w: 5.2, h: 0.55,
      fontSize: 17, color: C.darkBg, bold: true, margin: 0
    });
    s.addText("Seeking grant funding to complete security audit,\nmainnet deployment, and Philippines beta launch.", {
      x: 0.65, y: 2.1, w: 5.2, h: 0.55,
      fontSize: 12, color: C.darkBg, margin: 0
    });

    // Use of funds
    darkCard(s, 6.2, 1.38, 3.5, 1.4);
    s.addText("Use of Funds", { x: 6.35, y: 1.5, w: 3.2, h: 0.32, fontSize: 12, color: C.green, bold: true, margin: 0 });
    const funds = ["Smart contract audit (40%)", "Infrastructure & hosting (25%)", "Legal & compliance PH (20%)", "Marketing / community (15%)"];
    s.addText(funds.map((f, fi) => ({
      text: f, options: { bullet: true, breakLine: fi < funds.length - 1, paraSpaceAfter: 1 }
    })), { x: 6.35, y: 1.85, w: 3.2, h: 0.85, fontSize: 10, color: C.lightGray, margin: 0 });

    // What we bring back to Stellar
    s.addText("What This Delivers for the Stellar Ecosystem:", {
      x: 0.5, y: 3.0, w: 9, h: 0.32,
      fontSize: 13, color: C.white, bold: true, margin: 0
    });

    const returns = [
      { icon: FaUsers,      text: "Real-world Soroban adoption — actual loan and credit transactions on-chain" },
      { icon: FaGlobe,      text: "Financial inclusion impact in Southeast Asia's largest unbanked market" },
      { icon: FaHandshake,  text: "NGO and DAO liquidity partners integrating XLM-native lending pools" },
      { icon: FaChartLine,  text: "Open-source credit infrastructure other Stellar builders can extend" },
    ];

    for (let i = 0; i < 4; i++) {
      const x = 0.5 + (i % 2) * 4.75;
      const y = 3.45 + Math.floor(i / 2) * 0.85;
      const ico = await iconPng(returns[i].icon, "#22C55E", 256);
      s.addImage({ data: ico, x: x, y: y + 0.05, w: 0.35, h: 0.35 });
      s.addText(returns[i].text, { x: x + 0.5, y: y, w: 4.0, h: 0.7, fontSize: 11, color: C.lightGray, margin: 0 });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 15 — Closing Quote
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };

    // Large quote marks decorative
    s.addText("\u201C", { x: 0.3, y: 0.4, w: 1.5, h: 2.0, fontSize: 140, color: C.green, fontFace: "Georgia", margin: 0 });

    s.addText("Kredito transforms blockchain\nfrom speculation into accessible\nfinancial infrastructure.", {
      x: 1.0, y: 1.2, w: 8.5, h: 2.6,
      fontSize: 32, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    s.addText("— Kredito · Built on Stellar · 2026", {
      x: 1.0, y: 3.85, w: 8.5, h: 0.4,
      fontSize: 14, color: C.green, italic: true, margin: 0
    });

    // CTA
    s.addShape("roundRect", { x: 3.2, y: 4.55, w: 3.6, h: 0.7,
      fill: { color: C.green }, line: { color: C.green }, rectRadius: 0.06
    });
    s.addText("Let's Build Together →", {
      x: 3.2, y: 4.55, w: 3.6, h: 0.7,
      fontSize: 14, color: C.darkBg, bold: true, align: "center", valign: "middle", margin: 0
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 16 — Thank You (FIXED)
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.darkBg };

    s.addShape("rect", { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: C.green }, line: { color: C.green } });

    // Stellar badge
    s.addText("BUILT ON STELLAR", {
      x: 7.2, y: 0.3, w: 2.6, h: 0.35,
      fontSize: 9, color: C.green, bold: true, align: "right", charSpacing: 2, margin: 0
    });

    s.addText("Thank You.", {
      x: 0.55, y: 0.9, w: 9, h: 1.4,
      fontSize: 70, color: C.white, bold: true, fontFace: "Calibri", margin: 0
    });

    s.addText("Tirso Benedict Naza\nFounder, Kredito", {
      x: 0.55, y: 2.45, w: 5, h: 0.75,
      fontSize: 15, color: C.lightGray, margin: 0
    });

    // Contact cards
    const contacts = [
      { label: "GitHub", value: "github.com/kredito" },
      { label: "Email",  value: "tirso@kredito.xyz" },
      { label: "Web",    value: "kredito.xyz" },
    ];

    contacts.forEach((c, i) => {
      const x = 0.55 + i * 3.15;
      darkCard(s, x, 3.4, 2.85, 0.9);
      s.addText(c.label, { x: x + 0.15, y: 3.46, w: 2.55, h: 0.28, fontSize: 10, color: C.green, bold: true, margin: 0 });
      s.addText(c.value, { x: x + 0.15, y: 3.76, w: 2.55, h: 0.45, fontSize: 11, color: C.lightGray, margin: 0 });
    });

    s.addText("Kredito · Decentralized Microfinance on Stellar · Philippines", {
      x: 0.55, y: 5.1, w: 9, h: 0.3,
      fontSize: 10, color: C.gray, align: "left", margin: 0
    });

    // Decorative circle
    s.addShape("ellipse", { x: 7.5, y: 1.5, w: 3.5, h: 3.5,
      fill: { color: C.green, transparency: 90 }, line: { color: C.green, width: 0.5, transparency: 70 }
    });
  }

  // ── Write file ────────────────────────────────────────────────────────────────
  let outPath = "./Kredito_PitchDeck_Improved.pptx";
  const mntDir = "/mnt/user-data/outputs";
  if (fs.existsSync(mntDir)) {
    outPath = path.join(mntDir, "Kredito_PitchDeck_Improved.pptx");
  }
  await pres.writeFile({ fileName: outPath });
  console.log("✅ Written:", outPath);
}

build().catch(console.error);
