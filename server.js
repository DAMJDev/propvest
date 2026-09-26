// ═══════════════════════════════════════════════════
//  Prop Dev DNA — Backend Server  v2.0
//  Express + JSON DB · bcrypt · rate-limiting ·
//  email notifications · automated backups
// ═══════════════════════════════════════════════════
const express    = require('express');
const session    = require('express-session');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const multer     = require('multer');
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE    = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
[UPLOAD_DIR, BACKUP_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Admin credentials (override via env vars) ─────
const BASE_URL       = process.env.BASE_URL || 'https://propvest-production.up.railway.app';
const BASE_URL_HOST  = BASE_URL.replace(/^https?:\/\//, '');
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@propdevdna.com.au';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'PropDevDNA2026!';

// ══════════════════════════════════════════════════
//  EMAIL (nodemailer — logs to console if unconfigured)
// ══════════════════════════════════════════════════
let mailer = null;
if (process.env.SMTP_HOST) {
  mailer = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  mailer.verify(err => {
    if (err) console.error('[EMAIL] SMTP connection failed:', err.message);
    else     console.log('[EMAIL] SMTP ready ✅');
  });
}

function emailHtml(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="font-family:'Segoe UI',sans-serif;background:#0a0a0a;padding:32px 0">
  <div style="max-width:560px;margin:0 auto;background:#141414;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a">
    <div style="background:#0a0a0a;padding:24px 32px;border-bottom:1px solid #2a2a2a;text-align:center">
      <span style="font-size:1.4rem;font-weight:900;color:#c9a84c">PROP DEV DNA</span>
      <div style="font-size:.75rem;color:#666;margin-top:4px;letter-spacing:1px">PROPERTY DEVELOPMENT INVESTMENT PLATFORM</div>
    </div>
    <div style="padding:32px">${bodyHtml}</div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;font-size:.72rem;color:#555;text-align:center">
      Prop Dev DNA · Australia · <a href="${BASE_URL}" style="color:#c9a84c">${BASE_URL_HOST}</a><br>
      This email was sent to you because you have an account on Prop Dev DNA.
    </div>
  </div></body></html>`;
}

async function sendEmail(to, subject, bodyHtml) {
  const html = emailHtml(subject, bodyHtml);
  if (!mailer) {
    console.log(`[EMAIL — SMTP not configured]\n  To: ${to}\n  Subject: ${subject}`);
    return;
  }
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || '"Prop Dev DNA" <noreply@propdevdna.com.au>',
      to, subject, html
    });
    console.log(`[EMAIL SENT] ${subject} → ${to}`);
  } catch (e) {
    console.error('[EMAIL ERROR]', e.message);
  }
}

// ══════════════════════════════════════════════════
//  DATABASE BACKUP (every 6 hours, keep last 20)
// ══════════════════════════════════════════════════
function backupDB() {
  if (!fs.existsSync(DB_FILE)) return;
  try {
    const stamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const target  = path.join(BACKUP_DIR, `db-${stamp}.json`);
    fs.copyFileSync(DB_FILE, target);
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('db-')).sort();
    if (files.length > 20) {
      files.slice(0, files.length - 20).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
      });
    }
    console.log(`[BACKUP] Saved → ${path.basename(target)}`);
  } catch (e) {
    console.error('[BACKUP ERROR]', e.message);
  }
}
setInterval(backupDB, 6 * 60 * 60 * 1000); // every 6 hours

// ══════════════════════════════════════════════════
//  RATE LIMITER — brute-force protection on login
// ══════════════════════════════════════════════════
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute window
  max: 10,                    // 10 attempts per IP
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ══════════════════════════════════════════════════
//  MULTER — wholesale cert file upload
// ══════════════════════════════════════════════════
const certStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const safe = 'wc-' + req.session.userId + '-' + Date.now() + ext;
    cb(null, safe);
  }
});
const certUpload = multer({
  storage: certStorage,
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only PDF, JPG, or PNG files are accepted.'));
  }
});

// ══════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'propdevdna-secret-2026-xK9mP',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge:   7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production'
  }
}));

// ══════════════════════════════════════════════════
//  DEFAULT LISTINGS (seeded data)
// ══════════════════════════════════════════════════
const DEFAULT_LISTINGS = [
  {
    id:'hvr-001', type:'residential', badge:'NEW LISTING', badgeClass:'', status:'active',
    name:'Harbour View Residences', loc:'📍 Darling Harbour, Sydney NSW',
    irr:18.2, hold:'3.5 yr', profit:'$2.8M', fundedPct:68, minInvest:'$250,000',
    raise:'$18,500,000', structure:'Equity / Joint Venture', spotsLeft:6,
    photo:'https://picsum.photos/seed/hvr2026/800/400',
    heroPhoto:'https://picsum.photos/seed/hvr2026hero/1200/400',
    category:'Luxury Residential — Off-Plan',
    overview:'Harbour View Residences is a landmark 52-apartment luxury development perched above Darling Harbour. Premium 1, 2 & 3-bedroom apartments with unobstructed harbour views, resort-style amenities, and a world-class location just 300m from the CBD. The developer has a 20-year track record with 14 completed residential projects across NSW.',
    stats:[['52','Total Apartments'],['14 Levels','Tower Height'],['Q3 2027','Est. Completion'],['DA Approved','Planning Status']],
    floorplans:[['🛏','Type A — 1 Bed','52–62 m² · 14 Units · Level 3–7'],['🛏🛏','Type B — 2 Bed','78–95 m² · 28 Units · Level 5–13'],['🏠','Type C — 3 Bed','120–145 m² · 8 Units · Level 10–14'],['👑','Type D — Penthouse','240 m² · 2 Units · Level 14']],
    financials:[['Land Acquisition','$14,200,000'],['Construction Cost','$38,500,000'],['Professional Fees','$3,200,000'],['Marketing & Sales','$1,800,000'],['Holding & Finance Costs','$4,100,000'],['Contingency (8%)','$3,040,000'],['TOTAL DEV. COST','$64,840,000','total'],['Gross Realisable Value','$89,700,000'],['Agent Commission','–$2,242,500'],['Net Revenue','$87,457,500'],['Estimated Profit','$22,617,500','profit'],['Profit Margin on Cost','34.9%','profit']],
    roi:{intro:'Projected returns for a $500,000 equity contribution over 3.5 year hold',bars:[['Year 1','28%','+8%','$540k'],['Year 2','52%','+14%','$570k'],['Year 3','76%','+21%','$605k'],['Exit','100%','+27%','$635k']],summary:'$135,000 profit on $500k (+27% / 3.5yr) · IRR: 18.2% p.a.'},
    developer:{name:'Meridian Property Group',est:'Est. 2004 · Sydney, NSW',completed:14,gdv:'$890M',bio:'20 years delivering premium residential and commercial projects across NSW & VIC. All projects delivered on time and on budget.',badges:['✓ Verified','✓ Licensed Builder','✓ ASIC Registered']},
    devId:'u-demo-dev', createdAt: new Date().toISOString()
  },
  {
    id:'cse-002', type:'commercial', badge:'LIMITED SPOTS', badgeClass:'limited', status:'active',
    name:'The Exchange — Collins St', loc:'📍 Melbourne CBD, VIC',
    irr:21.6, hold:'5 yr', profit:'$4.1M', fundedPct:91, minInvest:'$500,000',
    raise:'$24,000,000', structure:'Preferred Equity', spotsLeft:2,
    photo:'https://picsum.photos/seed/collins2026/800/400',
    heroPhoto:'https://picsum.photos/seed/collins2026hero/1200/400',
    category:'Commercial — Strata Office',
    overview:'A premium strata office development on Melbourne\'s iconic Collins Street. The Exchange delivers A-grade office suites across 12 floors with end-of-trip facilities, rooftop terrace, and unmatched CBD connectivity. 82% pre-sold to owner-occupiers, providing significant de-risk for investors.',
    stats:[['48','Office Suites'],['12 Levels','Tower Height'],['Q4 2027','Est. Completion'],['DA Approved','Planning Status']],
    floorplans:[['💼','Type A — Small Suite','45–65 m² · 18 Units'],['🏢','Type B — Mid Suite','80–120 m² · 22 Units'],['🌆','Type C — Full Floor','380 m² · 6 Units'],['👑','Type D — Penthouse Office','620 m² · 2 Units']],
    financials:[['Land Acquisition','$22,000,000'],['Construction Cost','$58,000,000'],['Professional Fees','$5,100,000'],['Marketing & Sales','$2,400,000'],['Holding & Finance Costs','$6,800,000'],['Contingency (8%)','$4,800,000'],['TOTAL DEV. COST','$99,100,000','total'],['Gross Realisable Value','$138,000,000'],['Agent Commission','–$3,450,000'],['Net Revenue','$134,550,000'],['Estimated Profit','$35,450,000','profit'],['Profit Margin on Cost','35.8%','profit']],
    roi:{intro:'Projected returns for a $1,000,000 equity contribution over 5 year hold',bars:[['Year 1','22%','+8%','$1.08M'],['Year 2','44%','+15%','$1.15M'],['Year 3','62%','+20%','$1.20M'],['Year 4','82%','+26%','$1.26M'],['Exit','100%','+35%','$1.35M']],summary:'$350,000 profit on $1M (+35% / 5yr) · IRR: 21.6% p.a.'},
    developer:{name:'Apex Developments',est:'Est. 1998 · Melbourne, VIC',completed:22,gdv:'$2.1B',bio:'One of Victoria\'s most respected commercial developers with 28 years delivering premium office and retail assets.',badges:['✓ Verified','✓ Licensed Builder','✓ ASIC Registered','✓ Pre-sold 82%']},
    devId:'system', createdAt: new Date().toISOString()
  },
  {
    id:'rq-003', type:'mixed', badge:'OPEN', badgeClass:'', status:'active',
    name:'Riverside Quarter', loc:'📍 West End, Brisbane QLD',
    irr:15.8, hold:'4 yr', profit:'$1.9M', fundedPct:42, minInvest:'$150,000',
    raise:'$12,000,000', structure:'Equity / Joint Venture', spotsLeft:14,
    photo:'https://picsum.photos/seed/riverside2026/800/400',
    heroPhoto:'https://picsum.photos/seed/riverside2026hero/1200/400',
    category:'Mixed-Use — Townhouses + Retail',
    overview:'A vibrant mixed-use precinct in Brisbane\'s thriving West End. Riverside Quarter delivers 32 contemporary townhouses alongside ground-floor retail and café tenancies, creating a live-work-play community just 2km from the CBD on the Brisbane River.',
    stats:[['32','Townhouses'],['4 Levels','Max Height'],['Q1 2028','Est. Completion'],['DA Approved','Planning Status']],
    floorplans:[['🏠','Type A — 2 Bed','98 m² · 12 Units'],['🏡','Type B — 3 Bed','138 m² · 16 Units'],['🏘','Type C — 4 Bed','182 m² · 4 Units'],['🛍','Retail / Café','60–120 m² · 8 Tenancies']],
    financials:[['Land Acquisition','$8,500,000'],['Construction Cost','$22,000,000'],['Professional Fees','$1,800,000'],['Marketing & Sales','$1,200,000'],['Holding & Finance Costs','$2,400,000'],['Contingency (8%)','$1,920,000'],['TOTAL DEV. COST','$37,820,000','total'],['Gross Realisable Value','$52,000,000'],['Agent Commission','–$1,300,000'],['Net Revenue','$50,700,000'],['Estimated Profit','$12,880,000','profit'],['Profit Margin on Cost','34.1%','profit']],
    roi:{intro:'Projected returns for a $300,000 equity contribution over 4 year hold',bars:[['Year 1','20%','+6%','$318k'],['Year 2','40%','+12%','$336k'],['Year 3','65%','+18%','$354k'],['Exit','100%','+26%','$378k']],summary:'$78,000 profit on $300k (+26% / 4yr) · IRR: 15.8% p.a.'},
    developer:{name:'Riverstone Group',est:'Est. 2010 · Brisbane, QLD',completed:8,gdv:'$380M',bio:'Boutique Brisbane developer specialising in mixed-use urban infill projects that achieve premium sales rates.',badges:['✓ Verified','✓ Licensed Builder','✓ ASIC Registered']},
    devId:'system', createdAt: new Date().toISOString()
  },
  {
    id:'pp-004', type:'residential', badge:'OPEN', badgeClass:'', status:'active',
    name:'Pacifico Penthouses', loc:'📍 Gold Coast, QLD',
    irr:23.1, hold:'3 yr', profit:'$5.6M', fundedPct:25, minInvest:'$1,000,000',
    raise:'$42,000,000', structure:'Preferred Equity', spotsLeft:18,
    photo:'https://picsum.photos/seed/pacifico2026/800/400',
    heroPhoto:'https://picsum.photos/seed/pacifico2026hero/1200/400',
    category:'Luxury Residential — Beachfront',
    overview:'The Gold Coast\'s most exclusive beachfront address. Pacifico Penthouses delivers just 24 ultra-luxury apartments with private rooftop terraces, infinity pools, and direct beach access at Main Beach. A once-in-a-generation opportunity at Australia\'s most iconic coastal location.',
    stats:[['24','Apartments'],['32 Levels','Tower Height'],['Q2 2027','Est. Completion'],['DA Approved','Planning Status']],
    floorplans:[['🌊','Type A — Sky Suite','195 m² · 16 Units'],['🏖','Type B — Ocean Penthouse','320 m² · 6 Units'],['👑','Type C — Sub-Penthouse','480 m² · 1 Unit'],['🏆','The Crown Penthouse','680 m² · 1 Unit']],
    financials:[['Land Acquisition','$38,000,000'],['Construction Cost','$92,000,000'],['Professional Fees','$8,200,000'],['Marketing & Sales','$4,600,000'],['Holding & Finance Costs','$11,000,000'],['Contingency (8%)','$8,800,000'],['TOTAL DEV. COST','$162,600,000','total'],['Gross Realisable Value','$228,000,000'],['Agent Commission','–$5,700,000'],['Net Revenue','$222,300,000'],['Estimated Profit','$59,700,000','profit'],['Profit Margin on Cost','36.7%','profit']],
    roi:{intro:'Projected returns for a $2,000,000 equity contribution over 3 year hold',bars:[['Year 1','30%','+10%','$2.2M'],['Year 2','62%','+18%','$2.36M'],['Exit','100%','+32%','$2.64M']],summary:'$640,000 profit on $2M (+32% / 3yr) · IRR: 23.1% p.a.'},
    developer:{name:'Pacifico Living',est:'Est. 2008 · Gold Coast, QLD',completed:6,gdv:'$1.4B',bio:'Ultra-luxury beachfront specialist with an unbroken record of delivering record-breaking price-per-square-metre results.',badges:['✓ Verified','✓ Licensed Builder','✓ ASIC Registered','✓ Sold $180M prior project']},
    devId:'system', createdAt: new Date().toISOString()
  }
];

// ══════════════════════════════════════════════════
//  DATABASE HELPERS
// ══════════════════════════════════════════════════
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return seedDB();
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('DB read error:', e.message);
    return seedDB();
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ══════════════════════════════════════════════════
//  PROJECT STAGES & SUBCONTRACTOR SCORING BENCHMARKS
// ══════════════════════════════════════════════════
const STAGE_TEMPLATE = [
  'Site Establishment & Demolition',
  'Slab / Foundations',
  'Frame',
  'Lock-up (Roof, Windows, External Walls)',
  'Fit-Out & Fixing',
  'Practical Completion & Handover'
];

const STAGE_BENCHMARKS = [
  { id: 'ontime',  label: 'On-Time Delivery' },
  { id: 'quality', label: 'Quality of Workmanship' },
  { id: 'budget',  label: 'Budget Adherence' },
  { id: 'safety',  label: 'Safety & Compliance' }
];

function makeStages() {
  return STAGE_TEMPLATE.map((name, i) => ({
    id: `stg-${Date.now()}-${i}`,
    name,
    order: i,
    benchmarks: STAGE_BENCHMARKS,
    subcontractorId: null,
    subcontractorEmail: null,
    subcontractorName: null,
    dueDate: null,
    status: 'unassigned',
    score: null
  }));
}

function computeOverall(values) {
  const nums = STAGE_BENCHMARKS.map(b => Number(values[b.id])).filter(n => !isNaN(n) && n > 0);
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

// ══════════════════════════════════════════════════
//  SIX-DIMENSION RISK SCORE (1 = lower risk, 5 = higher risk)
//  Computed from listing data at request time. Indicative only.
// ══════════════════════════════════════════════════
const RISK_BANDS = [
  { max: 2.0,      label: 'Conservative' },
  { max: 2.7,      label: 'Balanced' },
  { max: 3.4,      label: 'Growth' },
  { max: Infinity, label: 'Speculative' }
];
const round1 = n => Math.round(n * 10) / 10;
const parseNum = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };
const listingState = l => (/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/.exec(l.loc || '') || [])[1] || 'AU';

function computeRisk(l, all) {
  const dims = [];
  const planning = String(((l.stats || []).find(s => s[1] === 'Planning Status') || [''])[0]).toLowerCase();
  let stage = 4, stageNote = 'Planning status not stated';
  if (/complete/.test(planning))            { stage = 1; stageNote = 'Completed'; }
  else if (/construction/.test(planning))   { stage = 2; stageNote = 'Under construction'; }
  else if (/da approved|approved/.test(planning)) { stage = 3; stageNote = 'DA approved, construction not started'; }
  else if (/lodged/.test(planning))         { stage = 4; stageNote = 'DA lodged, not yet approved'; }
  else if (/pre/.test(planning))            { stage = 5; stageNote = 'Pre-DA'; }
  dims.push({ key: 'stage', label: 'Development stage', score: stage, note: stageNote });

  const st = String(l.structure || '').toLowerCase();
  let cap = 4, capNote = 'Structure not stated';
  if (/senior|first mortgage/.test(st))       { cap = 1; capNote = 'Senior ranking'; }
  else if (/preferred/.test(st))              { cap = 2; capNote = 'Preferred equity — ranks ahead of developer profit'; }
  else if (/mezz|joint venture|jv/.test(st))  { cap = 3; capNote = 'Mezzanine / joint venture equity'; }
  else if (/equity/.test(st))                 { cap = 3; capNote = 'Equity'; }
  dims.push({ key: 'capital', label: 'Capital structure', score: cap, note: capNote });

  const done = parseNum(l.developer && l.developer.completed);
  const track = done == null ? 5 : done >= 20 ? 1 : done >= 10 ? 2 : done >= 5 ? 3 : done >= 1 ? 4 : 5;
  dims.push({ key: 'track', label: 'Developer track record', score: track, note: done == null ? 'No completed projects recorded' : `${done} completed projects (self-reported)` });

  const marginRow = (l.financials || []).find(r => /profit margin on cost/i.test(r[0]));
  const margin = parseNum((l.feaso && l.feaso.marginOnCost) != null ? l.feaso.marginOnCost : (marginRow && marginRow[1]));
  const feas = margin == null ? 4 : margin >= 30 ? 1 : margin >= 25 ? 2 : margin >= 20 ? 3 : margin >= 15 ? 4 : 5;
  dims.push({ key: 'feasibility', label: 'Feasibility margin', score: feas, note: margin == null ? 'Margin not verified' : `${margin}% margin on cost (platform minimum 15%)` });

  const hold = parseNum(l.hold);
  const liq = hold == null ? 4 : hold <= 2 ? 2 : hold <= 3.5 ? 3 : hold <= 5 ? 4 : 5;
  dims.push({ key: 'liquidity', label: 'Liquidity / hold period', score: liq, note: hold == null ? 'Hold period not stated' : `${hold} year hold, no secondary market` });

  const active = (all || []).filter(x => x.status === 'active');
  const sameKind = active.filter(x => listingState(x) === listingState(l) && x.type === l.type).length;
  const share = active.length ? sameKind / active.length : 1;
  const conc = share >= 0.5 ? 4 : share >= 0.34 ? 3 : 2;
  dims.push({ key: 'concentration', label: 'Market concentration', score: conc, note: `${Math.round(share * 100)}% of active platform listings are ${l.type || 'this type'} in ${listingState(l)}` });

  const composite = round1(dims.reduce((a, d) => a + d.score, 0) / dims.length);
  const band = RISK_BANDS.find(b => composite <= b.max).label;
  return { composite, band, dimensions: dims, basis: 'Indicative score computed from listing data. General information only — not financial product advice.' };
}

// Deal figures: a locked FEASO is authoritative; older seeded listings fall back to their financials table.
const finRow = (l, re) => ((l.financials || []).find(r => re.test(r[0])) || [])[1];
function dealFigures(l) {
  const f = l.feaso && l.feaso.computed ? l.feaso.computed : null;
  const i = l.feaso && l.feaso.inputs ? l.feaso.inputs : null;
  if (f && i) {
    return { tdc: f.tdc, grv: i.grv, construction: i.constructionCost, marginOnCost: f.marginOnCost, sellingCosts: f.sellingCosts, source: 'feaso' };
  }
  const tdc = parseNum(finRow(l, /total dev/i));
  const grv = parseNum(finRow(l, /gross realisable/i));
  const construction = parseNum(finRow(l, /^construction/i));
  const sell = parseNum(finRow(l, /agent commission/i));
  const margin = parseNum(finRow(l, /profit margin on cost/i));
  return { tdc, grv, construction, marginOnCost: margin, sellingCosts: sell != null ? Math.abs(sell) : null, source: 'listing' };
}

// Investor verification tiers: 1 registered, 2 wholesale verified, 3 funds verified, 4 PDD endorsed.
const TIER_RANK = { registered: 1, verified: 2, funds: 3, prequalified: 4 };
function investorTier(u) {
  if (!u || u.role !== 'investor') return null;
  const now = new Date();
  const wholesale = u.wholesaleStatus === 'verified' && (!u.wholesaleExpiresAt || new Date(u.wholesaleExpiresAt) > now);
  const funds = u.fundsStatus === 'verified' && (!u.fundsExpiresAt || new Date(u.fundsExpiresAt) > now);
  if (wholesale && funds && u.endorsed) return 'prequalified';
  if (wholesale && funds) return 'funds';
  if (wholesale) return 'verified';
  return 'registered';
}
const tierAtLeast = (u, name) => (TIER_RANK[investorTier(u)] || 0) >= TIER_RANK[name];

// Contractor compliance: licence and insurance must both be admin-verified and unexpired.
function docStatus(entry, expiry) {
  if (!entry) return 'missing';
  if (entry.status === 'verified') return (expiry && new Date(expiry) < new Date()) ? 'expired' : 'verified';
  return entry.status;
}
function contractorCompliance(u) {
  const c = u && u.contractor;
  if (!c) return { licence: 'missing', insurance: 'missing', compliant: false };
  const licence = docStatus(c.verification && c.verification.licence, c.licenceExpiry);
  const insurance = docStatus(c.verification && c.verification.insurance, c.insuranceExpiry);
  return { licence, insurance, compliant: licence === 'verified' && insurance === 'verified' };
}

function publicListing(l, all) {
  const { stages, feaso, actuals, valuation, drawdowns, ...rest } = l;
  const st = stages || [];
  const scored = st.filter(s => s.score);
  const fig = dealFigures(l);
  const lastActual = (actuals || [])[(actuals || []).length - 1] || null;
  return {
    ...rest,
    feasoStatus: feaso ? feaso.status : 'none',
    feasoMarginOnCost: feaso && feaso.marginOnCost != null ? feaso.marginOnCost : null,
    valuationRequired: fig.grv != null && fig.grv > 5000000,
    valuation: valuation && valuation.status === 'approved'
      ? { valuerName: valuation.valuerName, valuerRegistration: valuation.valuerRegistration, valuationDate: valuation.valuationDate, valueAmount: valuation.valueAmount, approvedAt: valuation.approvedAt }
      : null,
    valuationStatus: valuation ? valuation.status : 'none',
    actualsLatest: lastActual ? (({ qsFile, by, ...safe }) => ({ ...safe, hasQsFile: !!qsFile }))(lastActual) : null,
    drawdownCount: (drawdowns || []).length,
    risk: computeRisk(l, all),
    stageSummary: st.length ? {
      total: st.length,
      scored: scored.length,
      avgScore: scored.length ? round1(scored.reduce((a, s) => a + s.score.overall, 0) / scored.length) : null
    } : null
  };
}

// Demo data only: fictitious licence and policy numbers, pre-marked as verified so the demo flow can be shown.
function demoContractor() {
  const now = new Date().toISOString(), year = new Date(Date.now() + 365 * 86400000).toISOString();
  return {
    demo: true, publicId: 'tr-demo0001', businessName: 'Demo Concrete Pty Ltd', abn: '00000000000', trade: 'Concrete & Structural', phone: '',
    licenceNumber: 'DEMO-000000', licenceClass: 'Demo class', licenceState: 'NSW', licenceExpiry: year,
    insurerName: 'Demo Insurer', policyNumber: 'DEMO-POLICY', insuranceExpiry: year, publicLiability: '$20,000,000',
    codeAccepted: true, codeAcceptedAt: now, listedInDirectory: true, licenceFile: null, insuranceFile: null,
    verification: { licence: { status: 'verified', at: now, by: 'seed-demo', notes: 'Demo data' }, insurance: { status: 'verified', at: now, by: 'seed-demo', notes: 'Demo data' } },
    alerts: {}, updatedAt: now
  };
}

// Existing databases created before a feature existed get its demo data added once. Real accounts are never touched.
function migrateDemoData() {
  const db = readDB();
  let changed = false;
  const sub = db.users.find(u => u.id === 'u-demo-sub');
  if (sub && !sub.contractor) { sub.contractor = demoContractor(); changed = true; }
  if (changed) { writeDB(db); console.log('[MIGRATE] Added demo contractor profile.'); }
}

function seedDB() {
  // Pre-populate the flagship demo listing with stages so the demo
  // developer/subcontractor accounts have something real to show.
  const demoStages = makeStages();
  demoStages[0].subcontractorId = 'u-demo-sub';
  demoStages[0].subcontractorEmail = 'subcontractor@demo.com';
  demoStages[0].subcontractorName = 'Chris Demo';
  demoStages[0].dueDate = new Date(Date.now() - 14 * 86400000).toISOString();
  demoStages[0].status = 'scored';
  demoStages[0].score = {
    values: { ontime: 4, quality: 5, budget: 4, safety: 5 },
    notes: 'Clean handover, minor delay waiting on council inspection.',
    overall: 4.5,
    ratedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    ratedBy: 'u-demo-dev'
  };
  demoStages[1].subcontractorId = 'u-demo-sub';
  demoStages[1].subcontractorEmail = 'subcontractor@demo.com';
  demoStages[1].subcontractorName = 'Chris Demo';
  demoStages[1].dueDate = new Date(Date.now() + 21 * 86400000).toISOString();
  demoStages[1].status = 'assigned';

  const listings = DEFAULT_LISTINGS.map(l => l.id === 'hvr-001' ? { ...l, stages: demoStages } : l);

  const data = {
    users: [
      { id:'u-demo-inv', email:'investor@demo.com', password: hashPw('demo123'), fname:'Alex', lname:'Demo', role:'investor', joined: new Date().toISOString() },
      { id:'u-demo-dev', email:'developer@demo.com', password: hashPw('demo123'), fname:'Sam', lname:'Demo', role:'developer', joined: new Date().toISOString() },
      { id:'u-demo-sub', email:'subcontractor@demo.com', password: hashPw('demo123'), fname:'Chris', lname:'Demo', role:'subcontractor', trade:'Concrete & Structural', joined: new Date().toISOString(),
        contractor: demoContractor() },
      { id:'u-admin-001', email: ADMIN_EMAIL, password: hashPw(ADMIN_PASSWORD), fname:'Anthony', lname:'Admin', role:'admin', joined: new Date().toISOString() }
    ],
    listings,
    interests: [],
    subscriptions: [
      { id:'sub-demo-dev', userId:'u-demo-dev', userEmail:'developer@demo.com', userName:'Sam Demo', userRole:'developer', plan:'developer_monthly', paymentRef:'DEMO', status:'active', requestedAt: new Date().toISOString(), activatedAt: new Date().toISOString() }
    ],
    imReviews: [],
    imViewLogs: [],
    wholesaleCerts: [],
    partners: [],
    riskDeclarations: []
  };
  if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  writeDB(data);
  console.log('✅ Database seeded with demo accounts and 4 default listings.');
  return data;
}

// ══════════════════════════════════════════════════
//  PASSWORD HASHING (bcrypt) + legacy SHA-256 migration
// ══════════════════════════════════════════════════
function hashPw(pw) {
  return bcrypt.hashSync(pw, 12);
}

// Legacy SHA-256 hash (used for migration only)
function hashLegacy(pw) {
  return crypto.createHash('sha256').update(pw + 'propvest-salt').digest('hex');
}

// Verify password — supports both bcrypt and legacy SHA-256
function verifyPw(plain, stored) {
  if (!stored) return false;
  // bcrypt hash starts with $2b$ or $2a$
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    return bcrypt.compareSync(plain, stored);
  }
  // Legacy SHA-256
  return stored === hashLegacy(plain);
}

// ══════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ══════════════════════════════════════════════════
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireDev(req, res, next) {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || (user.role !== 'developer' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Developer account required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

function getActiveSubPlans(db, userId) {
  return (db.subscriptions || [])
    .filter(s => s.userId === userId && s.status === 'active')
    .map(s => s.plan);
}

// ── Wholesale status helper (checks expiry automatically) ──
function getWholesaleStatus(db, userId) {
  const user = db.users.find(u => u.id === userId);
  if (!user) return { ok: false, reason: 'not_found' };

  const status = user.wholesaleStatus || 'none';

  if (status === 'none')     return { ok: false, reason: 'not_submitted' };
  if (status === 'pending')  return { ok: false, reason: 'pending' };
  if (status === 'rejected') return { ok: false, reason: 'rejected' };
  if (status === 'expired')  return { ok: false, reason: 'expired' };

  if (status === 'verified') {
    // Auto-expire if past expiresAt
    if (user.wholesaleExpiresAt && new Date(user.wholesaleExpiresAt) < new Date()) {
      const idx = db.users.findIndex(u => u.id === userId);
      if (idx !== -1) db.users[idx].wholesaleStatus = 'expired';
      writeDB(db);
      return { ok: false, reason: 'expired' };
    }
    return { ok: true };
  }
  return { ok: false, reason: 'unknown' };
}

// ══════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════

// ── Auth ──────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { fname, lname, email, password, role, referralCode, trade } = req.body;
  if (!fname || !email || !password || !role) return res.status(400).json({ error: 'All fields required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!['investor','developer','subcontractor'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });

  const db = readDB();
  if (db.users.find(u => u.email === email.toLowerCase())) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  // Validate referral code if provided
  let referringPartner = null;
  if (referralCode) {
    referringPartner = (db.partners || []).find(p => p.referralCode === referralCode.toUpperCase() && p.active);
  }

  const user = {
    id:    'u-' + Date.now(),
    email: email.toLowerCase().trim(),
    password: hashPw(password),
    fname: fname.trim(),
    lname: (lname || '').trim(),
    role,
    trade: role === 'subcontractor' ? (trade || '').trim() : undefined,
    joined: new Date().toISOString(),
    referredBy:     referringPartner ? referringPartner.referralCode : null,
    referredByName: referringPartner ? referringPartner.name        : null,
    referredByFirm: referringPartner ? referringPartner.firm        : null
  };
  db.users.push(user);
  writeDB(db);
  req.session.userId = user.id;
  const { password: _, ...safeUser } = user;

  // Welcome email
  sendEmail(user.email, 'Welcome to Prop Dev DNA 🏗', `
    <h2 style="color:#e8e2d5;margin:0 0 12px">Welcome, ${user.fname}!</h2>
    <p style="color:#888;line-height:1.7">Your account has been created on <strong style="color:#c9a84c">Prop Dev DNA</strong> — Australia's wholesale property development investment platform.</p>
    ${role === 'investor' ? `<p style="color:#888;line-height:1.7">Your next step is to complete your <strong style="color:#c9a84c">Wholesale Investor Certification</strong> (s761G Corporations Act). Once approved, you'll have full access to all Investment Memorandums and FEASO reports.</p>` : role === 'developer' ? `<p style="color:#888;line-height:1.7">Upgrade to a Developer subscription to publish listings and generate Information Memorandums for wholesale investors.</p>` : `<p style="color:#888;line-height:1.7">You'll be notified when a developer assigns you to a project stage. Once a stage is complete, the developer scores your work against agreed benchmarks — your track record builds automatically.</p>`}
    <a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Go to Platform →</a>
  `);

  // Notify admin of new user
  sendEmail(ADMIN_EMAIL, `New ${role} registered: ${user.fname} ${user.lname}`, `
    <p style="color:#888">A new <strong style="color:#c9a84c">${role}</strong> has registered on Prop Dev DNA.</p>
    <p style="color:#888"><strong style="color:#e8e2d5">Name:</strong> ${user.fname} ${user.lname}<br>
    <strong style="color:#e8e2d5">Email:</strong> ${user.email}<br>
    <strong style="color:#e8e2d5">Referred by:</strong> ${referringPartner ? referringPartner.name + ' (' + referringPartner.firm + ')' : 'Direct'}</p>
  `);

  res.json({ ok: true, user: { ...safeUser, activeSubscriptions: [] } });
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email?.toLowerCase()?.trim());

  if (!user || !verifyPw(password, user.password)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  // Migrate legacy SHA-256 → bcrypt on successful login
  if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
    const idx = db.users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      db.users[idx].password = hashPw(password);
      writeDB(db);
      console.log(`[SECURITY] Migrated password hash for ${user.email} to bcrypt.`);
    }
  }

  req.session.userId = user.id;
  const { password: _, ...safeUser } = user;
  const activePlans = getActiveSubPlans(db, user.id);
  res.json({ ok: true, user: { ...safeUser, tier: investorTier(user), activeSubscriptions: activePlans } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.json({ user: null });
  const { password: _, ...safeUser } = user;
  const activePlans = getActiveSubPlans(db, user.id);
  res.json({ user: { ...safeUser, tier: investorTier(user), activeSubscriptions: activePlans } });
});

// ── Listings ──────────────────────────────────────
app.get('/api/listings', (req, res) => {
  const db = readDB();
  let listings = db.listings;

  if (req.session.userId) {
    const user = db.users.find(u => u.id === req.session.userId);
    if (user?.role === 'admin') {
      // Admin sees all listings
    } else if (user?.role === 'developer') {
      // Developers see their own (any status) + active from others
      listings = listings.filter(l => l.status === 'active' || l.devId === user.id);
    } else {
      // Investors see only active
      listings = listings.filter(l => l.status === 'active');
    }
  } else {
    // Unauthenticated: only active
    listings = listings.filter(l => l.status === 'active');
  }

  res.json(listings.map(l => publicListing(l, db.listings)));
});

app.get('/api/listings/:id', (req, res) => {
  const db = readDB();
  const listing = db.listings.find(l => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  res.json(publicListing(listing, db.listings));
});

// Only these fields may be set by a developer. Status, ownership, FEASO, stages,
// valuation and funding progress are controlled by the platform, never the client.
const PROJECT_FIELDS = ['name', 'loc', 'type', 'category', 'structure', 'hold', 'raise', 'minInvest', 'overview', 'irr', 'profit', 'trusteeEmail'];
function pickProject(body) {
  const out = {};
  PROJECT_FIELDS.forEach(k => {
    if (body[k] === undefined || body[k] === null) return;
    out[k] = typeof body[k] === 'string' ? body[k].replace(/[<>]/g, '').trim().slice(0, 4000) : body[k];
  });
  return out;
}

app.post('/api/listings', requireAuth, requireDev, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  const fields = pickProject(req.body);
  if (!fields.name) return res.status(400).json({ error: 'Project name is required.' });
  const listing = {
    ...fields,
    id:        'lst-' + Date.now(),
    devId:     req.session.userId,
    developer: { name: ((user.fname || '') + ' ' + (user.lname || '')).trim(), completed: 0, badges: [] },
    fundedPct: 0,
    status:    'draft',              // starts as draft — goes live after IM approval
    createdAt: new Date().toISOString()
  };
  db.listings.unshift(listing);
  writeDB(db);
  res.json({ ok: true, listing: publicListing(listing, db.listings) });
});

app.put('/api/listings/:id', requireAuth, requireDev, (req, res) => {
  const db = readDB();
  const idx = db.listings.findIndex(l => l.id === req.params.id && l.devId === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  if (['active', 'pending_review'].includes(db.listings[idx].status)) {
    return res.status(400).json({ error: 'A live listing or one under review cannot be edited. Contact the platform to request changes.' });
  }
  db.listings[idx] = { ...db.listings[idx], ...pickProject(req.body), id: req.params.id };
  writeDB(db);
  res.json({ ok: true, listing: publicListing(db.listings[idx], db.listings) });
});

app.delete('/api/listings/:id', requireAuth, requireDev, (req, res) => {
  const db = readDB();
  const idx = db.listings.findIndex(l => l.id === req.params.id && l.devId === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  db.listings.splice(idx, 1);
  writeDB(db);
  res.json({ ok: true });
});

// ── Interests (48-hour cooling-off), FEASO, valuation, actuals, tiers,
//    contractors, drawdowns and directories live in ./features/* ──

// ── Stats ─────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const db = readDB();
  res.json({
    listings:  db.listings.filter(l => l.status === 'active').length,
    investors: db.users.filter(u => u.role === 'investor').length,
    interests: db.interests.length
  });
});

// ── Project Stages & Subcontractor Scoring ────────
app.get('/api/listings/:id/stages', requireAuth, (req, res) => {
  const db = readDB();
  const listing = db.listings.find(l => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  const user = db.users.find(u => u.id === req.session.userId);
  const isOwner = listing.devId === user.id || user.role === 'admin';
  const stages = listing.stages || [];
  res.json(isOwner ? stages : stages.filter(s => s.subcontractorId === user.id));
});

app.post('/api/listings/:id/stages/init', requireAuth, requireDev, (req, res) => {
  const db   = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  const idx  = db.listings.findIndex(l => l.id === req.params.id && (l.devId === req.session.userId || user.role === 'admin'));
  if (idx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  if (!db.listings[idx].stages || !db.listings[idx].stages.length) {
    db.listings[idx].stages = makeStages();
    writeDB(db);
  }
  res.json({ ok: true, stages: db.listings[idx].stages });
});

app.put('/api/listings/:id/stages/:stageId/assign', requireAuth, requireDev, (req, res) => {
  const db   = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  const lIdx = db.listings.findIndex(l => l.id === req.params.id && (l.devId === req.session.userId || user.role === 'admin'));
  if (lIdx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  const stages = db.listings[lIdx].stages || [];
  const sIdx = stages.findIndex(s => s.id === req.params.stageId);
  if (sIdx === -1) return res.status(404).json({ error: 'Stage not found.' });

  const { subcontractorEmail, dueDate } = req.body;
  const sub = db.users.find(u => u.email === (subcontractorEmail || '').toLowerCase().trim() && u.role === 'subcontractor');
  if (!sub) return res.status(400).json({ error: 'No subcontractor account found with that email.' });

  stages[sIdx].subcontractorId    = sub.id;
  stages[sIdx].subcontractorEmail = sub.email;
  stages[sIdx].subcontractorName  = `${sub.fname} ${sub.lname}`.trim();
  stages[sIdx].dueDate            = dueDate || stages[sIdx].dueDate;
  stages[sIdx].status             = 'assigned';
  stages[sIdx].complianceAtAssign = { ...contractorCompliance(sub), at: new Date().toISOString() };
  writeDB(db);

  sendEmail(sub.email, `You've been assigned to a stage — ${db.listings[lIdx].name}`, `
    <p style="color:#888">You've been assigned to <strong style="color:#c9a84c">${stages[sIdx].name}</strong> on <strong style="color:#c9a84c">${db.listings[lIdx].name}</strong>.</p>
    ${dueDate ? `<p style="color:#888">Due: ${new Date(dueDate).toLocaleDateString('en-AU')}</p>` : ''}
    <a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View on Platform →</a>
  `);

  res.json({ ok: true, stage: stages[sIdx] });
});

app.post('/api/listings/:id/stages/:stageId/score', requireAuth, requireDev, (req, res) => {
  const db   = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  const lIdx = db.listings.findIndex(l => l.id === req.params.id && (l.devId === req.session.userId || user.role === 'admin'));
  if (lIdx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  const stages = db.listings[lIdx].stages || [];
  const sIdx = stages.findIndex(s => s.id === req.params.stageId);
  if (sIdx === -1) return res.status(404).json({ error: 'Stage not found.' });
  if (!stages[sIdx].subcontractorId) return res.status(400).json({ error: 'Assign a subcontractor before scoring this stage.' });

  const { values, notes } = req.body;
  const overall = computeOverall(values || {});
  if (overall === null) return res.status(400).json({ error: 'At least one benchmark score is required.' });

  stages[sIdx].score = { values, notes: notes || '', overall, ratedAt: new Date().toISOString(), ratedBy: user.id };
  stages[sIdx].status = 'scored';
  writeDB(db);

  const sub = db.users.find(u => u.id === stages[sIdx].subcontractorId);
  if (sub) {
    sendEmail(sub.email, `Your stage has been scored — ${stages[sIdx].name}`, `
      <p style="color:#888">Your work on <strong style="color:#c9a84c">${stages[sIdx].name}</strong> (${db.listings[lIdx].name}) has been scored: <strong style="color:#c9a84c">${overall}/5</strong>.</p>
      ${notes ? `<p style="color:#888">Notes: ${notes}</p>` : ''}
    `);
  }

  res.json({ ok: true, stage: stages[sIdx] });
});

// Subcontractor's own assigned stages, across every listing
app.get('/api/my/stages', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'subcontractor') return res.status(403).json({ error: 'Subcontractor account required.' });

  const mine = [];
  db.listings.forEach(l => (l.stages || []).forEach(s => {
    if (s.subcontractorId === user.id) mine.push({ ...s, listingId: l.id, listingName: l.name });
  }));
  const scored = mine.filter(s => s.score);
  const avgScore = scored.length ? Math.round((scored.reduce((a, s) => a + s.score.overall, 0) / scored.length) * 10) / 10 : null;
  res.json({ stages: mine, avgScore, scoredCount: scored.length });
});

// Directory of subcontractors (for developer assignment lookups)
app.get('/api/subcontractors', requireAuth, requireDev, (req, res) => {
  const db = readDB();
  const subs = db.users.filter(u => u.role === 'subcontractor').map(u => {
    const scores = [];
    db.listings.forEach(l => (l.stages || []).forEach(s => { if (s.subcontractorId === u.id && s.score) scores.push(s.score.overall); }));
    const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
    return { id: u.id, email: u.email, name: `${u.fname} ${u.lname}`.trim(), trade: (u.contractor && u.contractor.trade) || u.trade || '', avgScore, scoredCount: scores.length, compliance: contractorCompliance(u) };
  });
  res.json(subs);
});

// ── Subscriptions ─────────────────────────────────
app.post('/api/subscription/request', requireAuth, (req, res) => {
  const db   = readDB();
  if (!db.subscriptions) db.subscriptions = [];
  const user = db.users.find(u => u.id === req.session.userId);
  const { plan, paymentRef } = req.body;
  if (!plan) return res.status(400).json({ error: 'Plan required.' });

  const existing = db.subscriptions.find(s => s.userId === user.id && s.plan === plan && ['pending','active'].includes(s.status));
  if (existing) return res.json({ ok: true, subscription: existing, alreadyExists: true });

  const sub = {
    id:          'sub-' + Date.now(),
    userId:      user.id,
    userEmail:   user.email,
    userName:    (user.fname + ' ' + (user.lname || '')).trim(),
    userRole:    user.role,
    plan,
    paymentRef:  paymentRef || '',
    status:      'pending',
    requestedAt: new Date().toISOString(),
    activatedAt: null
  };
  db.subscriptions.push(sub);
  writeDB(db);

  // Notify admin
  sendEmail(ADMIN_EMAIL, `New subscription request: ${user.fname} — ${plan}`, `
    <p style="color:#888"><strong style="color:#e8e2d5">${user.fname} ${user.lname || ''}</strong> (${user.email}) has requested a <strong style="color:#c9a84c">${plan}</strong> subscription.<br>
    Payment ref: <strong style="color:#e8e2d5">${paymentRef || 'Not provided'}</strong></p>
    <p style="color:#888">Log in to the admin portal to approve or reject.</p>
  `);

  res.json({ ok: true, subscription: sub });
});

app.get('/api/subscription/status', requireAuth, (req, res) => {
  const db   = readDB();
  const subs = (db.subscriptions || []).filter(s => s.userId === req.session.userId);
  res.json({ subscriptions: subs });
});

app.get('/api/admin/subscriptions', requireAuth, requireAdmin, (req, res) => {
  const db      = readDB();
  const allUsers = db.users.map(({ password: _, ...u }) => u);
  const subs    = (db.subscriptions || []).slice().reverse();
  res.json({ subscriptions: subs, totalUsers: allUsers.length });
});

app.post('/api/admin/subscriptions/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const db  = readDB();
  if (!db.subscriptions) return res.status(404).json({ error: 'Not found.' });
  const sub = db.subscriptions.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found.' });
  sub.status      = 'active';
  sub.activatedAt = new Date().toISOString();
  writeDB(db);

  // Notify user
  sendEmail(sub.userEmail, '✅ Your Prop Dev DNA subscription is now active', `
    <h2 style="color:#e8e2d5;margin:0 0 12px">Subscription Activated</h2>
    <p style="color:#888">Your <strong style="color:#c9a84c">${sub.plan}</strong> subscription is now active. You can now publish listings and use the full developer portal.</p>
    <a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Go to Portal →</a>
  `);

  res.json({ ok: true });
});

app.post('/api/admin/subscriptions/:id/reject', requireAuth, requireAdmin, (req, res) => {
  const db  = readDB();
  if (!db.subscriptions) return res.status(404).json({ error: 'Not found.' });
  const sub = db.subscriptions.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found.' });
  sub.status = 'rejected';
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/admin/subscriptions/:id/cancel', requireAuth, requireAdmin, (req, res) => {
  const db  = readDB();
  if (!db.subscriptions) return res.status(404).json({ error: 'Not found.' });
  const sub = db.subscriptions.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found.' });
  sub.status = 'cancelled';
  writeDB(db);
  res.json({ ok: true });
});

// ── IM Review & Amendment Workflow ────────────────
app.post('/api/listings/:id/im-review', requireAuth, requireDev, (req, res) => {
  const db      = readDB();
  const listing = db.listings.find(l => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  const user    = db.users.find(u => u.id === req.session.userId);
  if (listing.devId !== req.session.userId && user.role !== 'admin') return res.status(403).json({ error: 'Not your listing.' });
  // Feasibility gate: a locked FEASO with at least the platform minimum margin is required before review.
  if (!listing.feaso || listing.feaso.status !== 'locked') {
    return res.status(400).json({ error: 'Complete and lock your FEASO before submitting for review.', code: 'feaso_required' });
  }
  if (!db.imReviews) db.imReviews = [];

  const { devResponse } = req.body;
  const existing = db.imReviews.find(r =>
    r.listingId === req.params.id && !['approved','withdrawn'].includes(r.status)
  );

  if (existing) {
    if (!existing.history) existing.history = [];
    existing.history.push({ round: existing.round, status: existing.status, at: new Date().toISOString(), amendments: (existing.amendments||[]).length });
    existing.status        = 'submitted';
    existing.round         = (existing.round || 1) + 1;
    existing.devResponse   = devResponse || '';
    existing.resubmittedAt = new Date().toISOString();
    existing.amendments    = [];
    existing.adminNotes    = '';
    writeDB(db);

    // Update listing status to pending_review
    const lstIdx = db.listings.findIndex(l => l.id === req.params.id);
    if (lstIdx !== -1) db.listings[lstIdx].status = 'pending_review';
    writeDB(db);

    // Notify admin of resubmission
    sendEmail(ADMIN_EMAIL, `IM resubmitted (Round ${existing.round}): ${listing.name}`, `
      <p style="color:#888"><strong style="color:#c9a84c">${listing.name}</strong> has been resubmitted for IM review (Round ${existing.round}) by <strong style="color:#e8e2d5">${user.fname} ${user.lname || ''}</strong>.</p>
    `);

    return res.json({ ok: true, review: existing, isResubmission: true });
  }

  const review = {
    id:             'imr-' + Date.now(),
    listingId:      req.params.id,
    listingName:    listing.name || 'Unnamed Listing',
    devId:          req.session.userId,
    devEmail:       user.email,
    devName:        (user.fname + ' ' + (user.lname || '')).trim(),
    status:         'submitted',
    round:          1,
    submittedAt:    new Date().toISOString(),
    resubmittedAt:  null,
    amendments:     [],
    adminNotes:     '',
    devResponse:    devResponse || '',
    approvedAt:     null,
    approvedBy:     null,
    history:        []
  };
  db.imReviews.push(review);

  // Set listing status to pending_review
  const lstIdx = db.listings.findIndex(l => l.id === req.params.id);
  if (lstIdx !== -1) db.listings[lstIdx].status = 'pending_review';

  writeDB(db);

  // Notify admin of new submission
  sendEmail(ADMIN_EMAIL, `New IM submitted for review: ${listing.name}`, `
    <p style="color:#888"><strong style="color:#c9a84c">${listing.name}</strong> has been submitted for IM review by <strong style="color:#e8e2d5">${user.fname} ${user.lname || ''}</strong> (${user.email}).</p>
    <p style="color:#888">Log in to the admin portal to review and approve.</p>
  `);

  res.json({ ok: true, review, isResubmission: false });
});

app.get('/api/listings/:id/im-review', requireAuth, (req, res) => {
  const db      = readDB();
  const reviews = (db.imReviews || []).filter(r => r.listingId === req.params.id);
  const review  = reviews.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;
  res.json({ review });
});

app.get('/api/admin/im-reviews', requireAuth, requireAdmin, (req, res) => {
  const db      = readDB();
  const reviews = (db.imReviews || []).slice().reverse();
  res.json({ reviews });
});

app.post('/api/admin/im-reviews/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const db     = readDB();
  if (!db.imReviews) return res.status(404).json({ error: 'Not found.' });
  const review = db.imReviews.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found.' });

  const adminUser = db.users.find(u => u.id === req.session.userId);
  if (!review.history) review.history = [];
  review.history.push({ round: review.round, status: 'approved', at: new Date().toISOString() });
  review.status     = 'approved';
  review.approvedAt = new Date().toISOString();
  review.approvedBy = (adminUser.fname + ' ' + (adminUser.lname || '')).trim();
  review.adminNotes = req.body.notes || '';
  review.amendments = [];

  // Set listing status to 'active' — it is now publicly visible
  const lstIdx = db.listings.findIndex(l => l.id === review.listingId);
  if (lstIdx !== -1) db.listings[lstIdx].status = 'active';

  writeDB(db);

  // Notify developer
  const dev = db.users.find(u => u.id === review.devId);
  if (dev) {
    sendEmail(dev.email, `✅ IM Approved — ${review.listingName} is now live`, `
      <h2 style="color:#e8e2d5;margin:0 0 12px">Your IM has been approved!</h2>
      <p style="color:#888">Your Information Memorandum for <strong style="color:#c9a84c">${review.listingName}</strong> has been reviewed and approved by our compliance team.</p>
      <p style="color:#888">Your listing is now <strong style="color:#27ae60">live</strong> and visible to all verified wholesale investors on the platform.</p>
      ${req.body.notes ? `<p style="color:#888"><strong style="color:#e8e2d5">Admin notes:</strong> ${req.body.notes}</p>` : ''}
      <a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Live Listing →</a>
    `);
  }

  res.json({ ok: true });
});

app.post('/api/admin/im-reviews/:id/request-amendments', requireAuth, requireAdmin, (req, res) => {
  const db     = readDB();
  if (!db.imReviews) return res.status(404).json({ error: 'Not found.' });
  const review = db.imReviews.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found.' });

  if (!review.history) review.history = [];
  review.history.push({ round: review.round, status: 'amendments_requested', at: new Date().toISOString(), amendmentCount: (req.body.amendments||[]).length });
  review.status     = 'amendments_requested';
  review.amendments = req.body.amendments || [];
  review.adminNotes = req.body.adminNotes || '';
  review.reviewedAt = new Date().toISOString();
  writeDB(db);

  // Notify developer
  const dev = db.users.find(u => u.id === review.devId);
  if (dev) {
    sendEmail(dev.email, `⚠️ Amendments Required — ${review.listingName}`, `
      <h2 style="color:#e8e2d5;margin:0 0 12px">Amendments Requested</h2>
      <p style="color:#888">Your IM for <strong style="color:#c9a84c">${review.listingName}</strong> requires the following amendments before it can be approved:</p>
      <ul style="color:#888;line-height:1.8;padding-left:20px">
        ${(req.body.amendments||[]).map(a => `<li>${a}</li>`).join('')}
      </ul>
      ${req.body.adminNotes ? `<p style="color:#888"><strong style="color:#e8e2d5">Notes:</strong> ${req.body.adminNotes}</p>` : ''}
      <p style="color:#888">Please address these items and resubmit via your developer portal.</p>
      <a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Go to Portal →</a>
    `);
  }

  res.json({ ok: true });
});

// ── IM View Audit Log (wholesale HARD GATE) ───────
app.post('/api/listings/:id/im-view-log', requireAuth, (req, res) => {
  const db   = readDB();
  const user = db.users.find(u => u.id === req.session.userId);

  // ── Wholesale hard-gate for investors ──
  if (user && user.role === 'investor') {
    const ws = getWholesaleStatus(db, req.session.userId);
    if (!ws.ok) {
      const messages = {
        not_submitted: 'You must complete Wholesale Investor Certification before accessing Investment Memorandums. This is required under s761G of the Corporations Act 2001.',
        pending:       'Your Wholesale Investor Certificate is currently under review. You will receive an email once approved — usually within 1 business day.',
        rejected:      'Your Wholesale Investor Certificate was not approved. Please contact support or resubmit with a valid signed certificate from a qualified accountant.',
        expired:       'Your Wholesale Investor Certificate has expired (valid for 2 years under s761G). Please submit a new certificate from a qualified accountant.',
        unknown:       'Wholesale investor verification is required to access this document.'
      };
      return res.status(403).json({
        error:   'wholesale_required',
        reason:  ws.reason,
        message: messages[ws.reason] || messages.unknown
      });
    }
  }

  if (!db.imViewLogs) db.imViewLogs = [];
  const listing = db.listings.find(l => l.id === req.params.id);

  const log = {
    id:                'ivl-' + Date.now(),
    listingId:         req.params.id,
    listingName:       listing?.name || '—',
    userId:            req.session.userId,
    userEmail:         user?.email || '—',
    userName:          user ? (user.fname + ' ' + (user.lname || '')).trim() : '—',
    userRole:          user?.role || '—',
    wholesaleConfirmed: !!req.body.wholesaleConfirmed,
    riskConfirmed:      !!req.body.riskConfirmed,
    viewedAt:          new Date().toISOString()
  };
  db.imViewLogs.push(log);
  writeDB(db);
  res.json({ ok: true, log });
});

app.get('/api/admin/im-view-logs', requireAuth, requireAdmin, (req, res) => {
  const db   = readDB();
  const logs = (db.imViewLogs || []).slice().reverse();
  res.json({ logs });
});

// ── Wholesale Certification ───────────────────────
app.post('/api/wholesale-cert', requireAuth, (req, res, next) => {
  certUpload.single('certFile')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const db = readDB();
    if (!db.wholesaleCerts) db.wholesaleCerts = [];
    const user = db.users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.educationCompletedAt) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Please complete the investor education module before submitting a certificate.', code: 'education_required' });
    }

    const existing = db.wholesaleCerts.find(c => c.userId === req.session.userId && ['pending','verified'].includes(c.status));
    if (existing) return res.status(400).json({ error: 'You already have a ' + existing.status + ' wholesale certificate on file.' });

    if (!req.file) return res.status(400).json({ error: 'You must upload the signed Qualified Accountant\'s Certificate (PDF, JPG, or PNG).' });

    const {
      investorName, investorDOB, investorAddress,
      acctName, acctFirm, acctAddress, acctPhone, acctEmail, acctMembership, acctMembershipNumber,
      certBasis, approxNetAssets, confirmedBothYears, investorDeclared
    } = req.body;

    if (!investorName || !acctName || !acctFirm || !acctMembership || !acctMembershipNumber || !certBasis || !investorDeclared) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'All required fields must be completed.' });
    }

    const cert = {
      id:            'wc-' + Date.now(),
      userId:        req.session.userId,
      userEmail:     user.email,
      userName:      (user.fname + ' ' + (user.lname || '')).trim(),
      status:        'pending',
      submittedAt:   new Date().toISOString(),
      reviewedAt:    null,
      reviewedBy:    null,
      expiresAt:     null,
      fileName:      req.file.originalname,
      filePath:      req.file.filename,
      investorName,  investorDOB: investorDOB || '', investorAddress: investorAddress || '',
      acctName,      acctFirm,    acctAddress: acctAddress || '',    acctPhone: acctPhone || '',
      acctEmail:     acctEmail || '', acctMembership, acctMembershipNumber,
      certBasis,
      approxNetAssets:    approxNetAssets || '',
      confirmedBothYears: confirmedBothYears === 'true' || confirmedBothYears === true,
      investorDeclared:   true,
      adminNotes:         ''
    };

    // Accountant self-verification: 1 in 5 certificates is flagged for an admin register spot-check
    cert.spotCheckRequired = ((db.wholesaleCerts.length + 1) % 5 === 0);
    cert.accountantVerification = cert.acctEmail ? {
      token: crypto.randomBytes(24).toString('hex'),
      status: 'requested',
      requestedAt: new Date().toISOString(),
      verifiedAt: null
    } : null;

    db.wholesaleCerts.push(cert);
    const userIdx = db.users.findIndex(u => u.id === req.session.userId);
    if (userIdx !== -1) db.users[userIdx].wholesaleStatus = 'pending';
    writeDB(db);

    // Notify investor of submission
    sendEmail(user.email, '⏳ Wholesale Certificate Received — Under Review', `
      <h2 style="color:#e8e2d5;margin:0 0 12px">Certificate Received</h2>
      <p style="color:#888">We've received your Wholesale Investor Certificate signed by <strong style="color:#c9a84c">${acctName}</strong> (${acctMembership} ${acctMembershipNumber}).</p>
      <p style="color:#888">Our team will review it within <strong style="color:#e8e2d5">1 business day</strong>. You'll receive an email once approved and you'll have full access to Investment Memorandums and FEASO reports.</p>
    `);

    // Notify admin
    sendEmail(ADMIN_EMAIL, `New wholesale cert to review: ${user.fname} ${user.lname || ''}`, `
      <p style="color:#888"><strong style="color:#c9a84c">${user.fname} ${user.lname || ''}</strong> (${user.email}) has submitted a Wholesale Investor Certificate.</p>
      <p style="color:#888">Accountant: <strong style="color:#e8e2d5">${acctName}</strong> — ${acctFirm} (${acctMembership} ${acctMembershipNumber})<br>
      Basis: ${certBasis === 'net_assets' ? 'Net Assets ≥ $2.5M' : 'Gross Income ≥ $250k p.a.'}</p>
      <p style="color:#888">Log in to download the certificate and approve or reject.</p>
    `);

    if (cert.accountantVerification) sendAccountantLink(cert);

    res.json({ ok: true, cert: publicCert(cert) });
  });
});

app.get('/api/wholesale-cert/status', requireAuth, (req, res) => {
  const db    = readDB();
  if (!db.wholesaleCerts) db.wholesaleCerts = [];

  // Check expiry while we're here
  const wsStatus = getWholesaleStatus(db, req.session.userId);

  const certs  = db.wholesaleCerts.filter(c => c.userId === req.session.userId).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const latest = certs[0] || null;
  const user   = db.users.find(u => u.id === req.session.userId);
  res.json({ cert: latest ? publicCert(latest) : null, wholesaleStatus: user?.wholesaleStatus || 'none', wsOk: wsStatus.ok, educationCompletedAt: user?.educationCompletedAt || null });
});

app.get('/api/admin/wholesale-certs', requireAuth, requireAdmin, (req, res) => {
  const db    = readDB();
  const certs = (db.wholesaleCerts || []).slice().reverse().map(publicCert);
  res.json({ certs });
});

app.post('/api/admin/wholesale-certs/:id/resend-accountant-link', requireAuth, requireAdmin, (req, res) => {
  const db   = readDB();
  const cert = (db.wholesaleCerts || []).find(c => c.id === req.params.id);
  if (!cert || !cert.accountantVerification) return res.status(404).json({ error: 'No accountant verification on this certificate.' });
  if (cert.accountantVerification.status === 'verified') return res.status(400).json({ error: 'Already verified.' });
  sendAccountantLink(cert);
  res.json({ ok: true });
});

app.post('/api/admin/wholesale-certs/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const db   = readDB();
  if (!db.wholesaleCerts) return res.status(404).json({ error: 'Not found.' });
  const cert = db.wholesaleCerts.find(c => c.id === req.params.id);
  if (!cert)  return res.status(404).json({ error: 'Certificate not found.' });

  const av = cert.accountantVerification;
  if (av && av.status !== 'verified' && !req.body.override) {
    return res.status(400).json({ error: 'The accountant has not yet completed self-verification. Resend the link, or approve with override.', code: 'accountant_pending' });
  }
  const admin      = db.users.find(u => u.id === req.session.userId);
  cert.status      = 'verified';
  cert.reviewedAt  = new Date().toISOString();
  cert.reviewedBy  = admin?.email || 'admin';
  cert.expiresAt   = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
  cert.adminNotes  = req.body.notes || '';

  const userIdx = db.users.findIndex(u => u.id === cert.userId);
  if (userIdx !== -1) {
    db.users[userIdx].wholesaleStatus      = 'verified';
    db.users[userIdx].wholesaleVerifiedAt  = cert.reviewedAt;
    db.users[userIdx].wholesaleExpiresAt   = cert.expiresAt;
  }
  writeDB(db);

  // Notify investor
  const investor = db.users.find(u => u.id === cert.userId);
  if (investor) {
    sendEmail(investor.email, '✅ Wholesale Certification Approved — Full Access Granted', `
      <h2 style="color:#e8e2d5;margin:0 0 12px">You're now a verified wholesale investor!</h2>
      <p style="color:#888">Your Wholesale Investor Certificate has been approved. You now have full access to all Investment Memorandums and FEASO reports on Prop Dev DNA.</p>
      <p style="color:#888"><strong style="color:#e8e2d5">Certified by:</strong> ${cert.acctName} (${cert.acctMembership})<br>
      <strong style="color:#e8e2d5">Valid until:</strong> ${new Date(cert.expiresAt).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' })}</p>
      <a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Browse Investment Opportunities →</a>
    `);
  }

  res.json({ ok: true, cert });
});

app.get('/api/admin/wholesale-certs/:id/download', requireAuth, requireAdmin, (req, res) => {
  const db   = readDB();
  const cert = (db.wholesaleCerts || []).find(c => c.id === req.params.id);
  if (!cert || !cert.filePath) return res.status(404).json({ error: 'File not found.' });
  const filePath = path.join(UPLOAD_DIR, cert.filePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing from server.' });
  res.download(filePath, cert.fileName || cert.filePath);
});

app.post('/api/admin/wholesale-certs/:id/reject', requireAuth, requireAdmin, (req, res) => {
  const db   = readDB();
  if (!db.wholesaleCerts) return res.status(404).json({ error: 'Not found.' });
  const cert = db.wholesaleCerts.find(c => c.id === req.params.id);
  if (!cert)  return res.status(404).json({ error: 'Certificate not found.' });

  const admin     = db.users.find(u => u.id === req.session.userId);
  cert.status     = 'rejected';
  cert.reviewedAt = new Date().toISOString();
  cert.reviewedBy = admin?.email || 'admin';
  cert.adminNotes = req.body.notes || '';

  const userIdx = db.users.findIndex(u => u.id === cert.userId);
  if (userIdx !== -1) db.users[userIdx].wholesaleStatus = 'rejected';
  writeDB(db);

  // Notify investor
  const investor = db.users.find(u => u.id === cert.userId);
  if (investor) {
    sendEmail(investor.email, '❌ Wholesale Certificate Not Approved — Action Required', `
      <h2 style="color:#e8e2d5;margin:0 0 12px">Certificate Not Approved</h2>
      <p style="color:#888">Unfortunately, your Wholesale Investor Certificate could not be approved at this time.</p>
      ${cert.adminNotes ? `<p style="color:#888"><strong style="color:#e8e2d5">Reason:</strong> ${cert.adminNotes}</p>` : ''}
      <p style="color:#888">Please obtain a new signed certificate from a qualified accountant (CPA Australia, CA ANZ, or IPA member) and resubmit via your portal.</p>
      <a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Resubmit Certificate →</a>
    `);
  }

  res.json({ ok: true, cert });
});

// ══════════════════════════════════════════════════
//  INVESTOR EDUCATION MODULE
// ══════════════════════════════════════════════════
const EDUCATION = [
  { title: 'How development finance works',
    body: ['Property development finance funds the construction of new buildings before they can be sold.',
           'Senior debt comes from a lender and is repaid first. Subordinated capital, such as preferred or mezzanine equity, sits behind the senior lender and carries more risk in exchange for a higher target return.',
           'Projects can be delayed, cost more than planned, or sell for less than forecast.'],
    q: 'Which capital is repaid first from sale proceeds?',
    options: ['Senior debt from the lender', 'Preferred equity investors', 'The developer\'s profit share'], answer: 0 },
  { title: 'Preferred equity and the waterfall',
    body: ['A distribution waterfall sets the order in which sale proceeds are paid out.',
           'In a typical structure the senior lender is repaid first, then project costs, then investor principal and preferred return, and only then is the developer\'s profit share paid.',
           'If proceeds fall short, the investors lowest in the waterfall are the first to lose money.'],
    q: 'In a typical waterfall, who is paid before the developer takes profit?',
    options: ['Nobody — the developer is paid first', 'The senior lender and preferred investors', 'Only the platform'], answer: 1 },
  { title: 'Capital at risk',
    body: ['You can lose some or all of the money you invest.',
           'A target return, such as an 18% IRR, is what the deal is aiming for. It is not a promise and it is not a minimum.',
           'Past performance of a developer or a project is not a reliable indicator of future performance.'],
    q: 'A target IRR of 18% means:',
    options: ['You are guaranteed 18% a year', 'It is a target that may not be achieved', 'It is the minimum you will receive'], answer: 1 },
  { title: 'Illiquidity',
    body: ['Development investments are typically locked in until the project is built and sold, often 3 to 5 years.',
           'There is usually no market where you can sell your interest early, and you may not be able to withdraw when you want to.',
           'Only invest money you will not need during the project.'],
    q: 'If you need your money back in year 2, you should expect that:',
    options: ['You can sell your interest immediately', 'You can withdraw at any time', 'Your money may be unavailable until the project completes'], answer: 2 },
  { title: 'Wholesale investors and general information',
    body: ['Opportunities on this platform are available only to wholesale clients under s.761G of the Corporations Act 2001 (Cth), confirmed by a certificate from a qualified accountant.',
           'Everything on the platform is general information. It is not personal financial product advice and does not take your objectives, financial situation or needs into account.',
           'Consider seeking independent financial and legal advice before you invest.'],
    q: 'Is the information on the platform personal financial advice?',
    options: ['Yes, it is tailored to me', 'No, it is general information only', 'Only once I am verified'], answer: 1 }
];

app.get('/api/education', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  res.json({
    modules: EDUCATION.map(m => ({ title: m.title, body: m.body, q: m.q, options: m.options })),
    completedAt: user?.educationCompletedAt || null
  });
});

app.post('/api/education/submit', requireAuth, (req, res) => {
  const db = readDB();
  const idx = db.users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found.' });
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const results = EDUCATION.map((m, i) => answers[i] === m.answer);
  const passed = results.every(Boolean);
  if (!db.educationLogs) db.educationLogs = [];
  db.educationLogs.push({ id: 'edu-' + Date.now(), userId: req.session.userId, at: new Date().toISOString(), passed, ip: req.ip });
  if (passed && !db.users[idx].educationCompletedAt) db.users[idx].educationCompletedAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true, passed, results, completedAt: db.users[idx].educationCompletedAt || null });
});

app.post('/api/profile/risk-profile', requireAuth, (req, res) => {
  const v = req.body.riskProfile;
  if (!['conservative', 'balanced', 'growth', 'aggressive'].includes(v)) return res.status(400).json({ error: 'Invalid risk profile.' });
  const db = readDB();
  const idx = db.users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found.' });
  db.users[idx].riskProfile = v;
  writeDB(db);
  res.json({ ok: true, riskProfile: v });
});

// ══════════════════════════════════════════════════
//  ACCOUNTANT SELF-VERIFICATION (no login — emailed link)
// ══════════════════════════════════════════════════
const ACCOUNTANT_DECLARATIONS = [
  'I am a current member of CPA Australia, Chartered Accountants ANZ or the Institute of Public Accountants and the membership number stated is correct.',
  'I meet the definition of a qualified accountant under section 88B of the Corporations Act 2001 (Cth).',
  'I have reviewed the evidence supplied by the investor for the basis stated (net assets of at least $2.5 million, or gross income of at least $250,000 in each of the last two financial years).',
  'I have no financial interest in Prop Dev DNA or in the investor\'s investment beyond my professional fee.',
  'I understand this declaration is timestamped and stored, and may be checked against the professional body\'s register.'
];

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 40,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true, legacyHeaders: false,
});

function publicCert(cert) {
  const c = { ...cert };
  if (c.accountantVerification) {
    const { token, ...av } = c.accountantVerification;
    c.accountantVerification = av;
  }
  return c;
}

function sendAccountantLink(cert) {
  const av = cert.accountantVerification;
  if (!av || !cert.acctEmail) return;
  const link = `${BASE_URL}/?page=verify&token=${av.token}`;
  sendEmail(cert.acctEmail, `Please verify a wholesale investor certificate — ${cert.investorName}`, `
    <p style="color:#888">Hello ${cert.acctName},</p>
    <p style="color:#888"><strong style="color:#e8e2d5">${cert.investorName}</strong> has submitted a wholesale investor certificate on Prop Dev DNA naming you as the certifying accountant.</p>
    <p style="color:#888">Please confirm your membership and make five short declarations. It takes about two minutes and needs no login.</p>
    <a href="${link}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Verify now →</a>
    <p style="color:#666;font-size:12px;margin-top:16px">If you did not certify this investor, do not use the link and please reply to let us know.</p>
  `);
}

function findCertByToken(db, token) {
  return (db.wholesaleCerts || []).find(c => c.accountantVerification && token && c.accountantVerification.token === token);
}

app.get('/api/accountant-verify/:token', verifyLimiter, (req, res) => {
  const db = readDB();
  const cert = findCertByToken(db, req.params.token);
  if (!cert) return res.status(404).json({ error: 'This verification link is not valid.' });
  res.json({
    status: cert.accountantVerification.status,
    investorName: cert.investorName,
    basis: cert.certBasis === 'net_assets' ? 'Net assets of at least $2.5 million' : 'Gross income of at least $250,000 in each of the last two financial years',
    acctName: cert.acctName, acctFirm: cert.acctFirm, acctMembership: cert.acctMembership,
    declarations: ACCOUNTANT_DECLARATIONS
  });
});

app.post('/api/accountant-verify/:token', verifyLimiter, (req, res) => {
  const db = readDB();
  const cert = findCertByToken(db, req.params.token);
  if (!cert) return res.status(404).json({ error: 'This verification link is not valid.' });
  const av = cert.accountantVerification;
  if (av.status === 'verified') return res.status(400).json({ error: 'This certificate has already been verified.' });

  const { membershipNumber, signedName, declarations } = req.body;
  if (!signedName || !String(signedName).trim()) return res.status(400).json({ error: 'Please type your full name to sign.' });
  if (!membershipNumber || String(membershipNumber).trim().toLowerCase() !== String(cert.acctMembershipNumber).trim().toLowerCase()) {
    return res.status(400).json({ error: 'The membership number does not match the certificate.' });
  }
  if (!Array.isArray(declarations) || declarations.length !== ACCOUNTANT_DECLARATIONS.length || !declarations.every(d => d === true)) {
    return res.status(400).json({ error: 'All five declarations must be confirmed.' });
  }

  const at = new Date().toISOString();
  av.status = 'verified';
  av.verifiedAt = at;
  av.signedName = String(signedName).trim();
  av.ip = req.ip;
  av.declarations = ACCOUNTANT_DECLARATIONS.map(text => ({ text, confirmed: true, at }));
  writeDB(db);

  sendEmail(ADMIN_EMAIL, `Accountant verified certificate — ${cert.investorName}`, `
    <p style="color:#888"><strong style="color:#c9a84c">${av.signedName}</strong> (${cert.acctMembership} ${cert.acctMembershipNumber}) has completed self-verification for ${cert.investorName}.${cert.spotCheckRequired ? ' <strong style="color:#e8e2d5">This certificate is flagged for an admin register spot-check.</strong>' : ''}</p>
  `);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════
//  MILESTONE CERTIFICATES (locked once issued)
// ══════════════════════════════════════════════════
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function certHash(c) {
  return crypto.createHash('sha256').update(JSON.stringify({
    id: c.id, listingId: c.listingId, stageId: c.stageId, snapshot: c.snapshot,
    builderName: c.builderName, inspectorName: c.inspectorName, inspectorLicence: c.inspectorLicence, issuedAt: c.issuedAt
  })).digest('hex');
}

app.post('/api/listings/:id/stages/:stageId/certificate', requireAuth, requireDev, (req, res) => {
  const db   = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  const lIdx = db.listings.findIndex(l => l.id === req.params.id && (l.devId === req.session.userId || user.role === 'admin'));
  if (lIdx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  const listing = db.listings[lIdx];
  const stage = (listing.stages || []).find(s => s.id === req.params.stageId);
  if (!stage) return res.status(404).json({ error: 'Stage not found.' });
  if (stage.status !== 'scored') return res.status(400).json({ error: 'Score the stage before issuing a milestone certificate.' });
  if (stage.certificate) return res.status(400).json({ error: 'A certificate has already been issued for this stage and is locked.' });

  const { builderName, inspectorName, inspectorLicence, builderSigned, inspectorCountersigned } = req.body;
  if (!builderName || !inspectorName || !inspectorLicence) return res.status(400).json({ error: 'Builder name, inspector name and inspector licence are required.' });
  if (builderSigned !== true || inspectorCountersigned !== true) return res.status(400).json({ error: 'Builder signature and inspector countersignature are both required.' });
  const recipients = (Array.isArray(req.body.recipients) ? req.body.recipients : []).map(e => String(e).trim()).filter(Boolean).slice(0, 10);
  if (recipients.some(e => !EMAIL_RE.test(e))) return res.status(400).json({ error: 'One of the recipient emails is not valid.' });

  const cert = {
    id: 'mc-' + crypto.randomBytes(12).toString('hex'),
    listingId: listing.id, stageId: stage.id,
    snapshot: {
      listingName: listing.name, location: listing.loc, stageName: stage.name,
      contractor: stage.subcontractorName, score: stage.score.overall, benchmarks: stage.benchmarks.map(b => ({ label: b.label, value: stage.score.values[b.id] || null })),
      scoredAt: stage.score.ratedAt
    },
    builderName: String(builderName).trim(), inspectorName: String(inspectorName).trim(), inspectorLicence: String(inspectorLicence).trim(),
    issuedAt: new Date().toISOString(), issuedBy: user.id, locked: true
  };
  cert.hash = certHash(cert);
  stage.certificate = cert;
  writeDB(db);

  const link = `${BASE_URL}/?page=certificate&id=${cert.id}`;
  recipients.forEach(to => sendEmail(to, `Milestone certificate — ${listing.name}: ${stage.name}`, `
    <p style="color:#888">A milestone certificate has been issued for <strong style="color:#c9a84c">${stage.name}</strong> on <strong style="color:#c9a84c">${listing.name}</strong>.</p>
    <p style="color:#888">Signed by the builder (${cert.builderName}) and countersigned by the inspector (${cert.inspectorName}, licence ${cert.inspectorLicence}).</p>
    <a href="${link}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View certificate →</a>
  `));
  res.json({ ok: true, certificate: cert, stage });
});

app.get('/api/certificates/:id', (req, res) => {
  const db = readDB();
  for (const l of db.listings) {
    const s = (l.stages || []).find(x => x.certificate && x.certificate.id === req.params.id);
    if (s) return res.json({ certificate: s.certificate, intact: certHash(s.certificate) === s.certificate.hash });
  }
  res.status(404).json({ error: 'Certificate not found.' });
});

// ══════════════════════════════════════════════════
//  REGULATOR / COMPLIANCE OVERVIEW (read-only)
// ══════════════════════════════════════════════════
function requireRegulator(req, res, next) {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || (user.role !== 'regulator' && user.role !== 'admin')) return res.status(403).json({ error: 'Regulator or admin access required.' });
  next();
}

app.get('/api/regulator/overview', requireAuth, requireRegulator, (req, res) => {
  const db = readDB();
  const certs = db.wholesaleCerts || [];
  const by = (arr, f) => arr.filter(f).length;
  const investors = db.users.filter(u => u.role === 'investor');
  const stagesAll = db.listings.flatMap(l => l.stages || []);
  const scored = stagesAll.filter(s => s.score);
  res.json({
    generatedAt: new Date().toISOString(),
    wholesaleCertificates: {
      total: certs.length,
      pending: by(certs, c => c.status === 'pending'), verified: by(certs, c => c.status === 'verified'), rejected: by(certs, c => c.status === 'rejected'),
      accountantVerified: by(certs, c => c.accountantVerification && c.accountantVerification.status === 'verified'),
      accountantAwaiting: by(certs, c => c.accountantVerification && c.accountantVerification.status === 'requested'),
      spotChecksFlagged: by(certs, c => c.spotCheckRequired)
    },
    investors: {
      total: investors.length,
      educationCompleted: by(investors, u => u.educationCompletedAt),
      riskDeclarations: (db.riskDeclarations || []).length
    },
    listings: db.listings.map(l => {
      const r = computeRisk(l, db.listings);
      const rev = (db.imReviews || []).filter(x => x.listingId === l.id).slice(-1)[0];
      const st = l.stages || [];
      return { id: l.id, name: l.name, status: l.status, feasoOnFile: !!(l.feaso && l.feaso.status === 'locked'), riskComposite: r.composite, riskBand: r.band,
               valuationStatus: l.valuation ? l.valuation.status : (dealFigures(l).grv > 5000000 ? 'required, not submitted' : 'not required'),
               actualsReports: (l.actuals || []).length, varianceAlerts: by(l.actuals || [], a => a.alert), drawdowns: (l.drawdowns || []).length,
               imReviewStatus: rev ? rev.status : 'none', stages: st.length, stagesScored: by(st, s => s.score), certificatesIssued: by(st, s => s.certificate) };
    }),
    contractorScoring: {
      stagesTotal: stagesAll.length, stagesScored: scored.length,
      averageScore: scored.length ? round1(scored.reduce((a, s) => a + s.score.overall, 0) / scored.length) : null,
      milestoneCertificates: by(stagesAll, s => s.certificate)
    },
    tiers: {
      registered: by(investors, u => investorTier(u) === 'registered'), verified: by(investors, u => investorTier(u) === 'verified'),
      funds: by(investors, u => investorTier(u) === 'funds'), prequalified: by(investors, u => investorTier(u) === 'prequalified'),
      fundsProofsPending: by(db.fundsProofs || [], p => p.status === 'pending')
    },
    expressionsOfInterest: {
      pending: by(db.interests || [], i => i.status === 'pending_confirmation'), confirmed: by(db.interests || [], i => i.status === 'confirmed'),
      withdrawn: by(db.interests || [], i => i.status === 'withdrawn'), lapsed: by(db.interests || [], i => i.status === 'lapsed')
    },
    contractors: (() => {
      const subs = db.users.filter(u => u.role === 'subcontractor');
      return { registered: subs.length, withProfile: by(subs, u => u.contractor), compliant: by(subs, u => contractorCompliance(u).compliant), awaitingVerification: by(subs, u => u.contractor && ['licence', 'insurance'].some(k => u.contractor.verification && u.contractor.verification[k] && u.contractor.verification[k].status === 'pending')) };
    })(),
    drawdowns: (() => {
      const all = db.listings.flatMap(l => l.drawdowns || []);
      return { total: all.length, ready: by(all, d => d.status === 'ready'), blocked: by(all, d => d.status === 'blocked'), released: by(all, d => d.status === 'released') };
    })(),
    controls: [
      { name: 'Wholesale certificate review (admin approval, 2-year expiry)', status: 'live' },
      { name: 'Accountant self-verification (five timestamped declarations)', status: 'live' },
      { name: 'Investor education module (required before certificate)', status: 'live' },
      { name: 'Per-deal risk, summary and waterfall acknowledgment (timestamped, IP-logged)', status: 'live' },
      { name: '48-hour confirm-or-withdraw window on expressions of interest', status: 'live' },
      { name: 'FEASO builder: 15% margin gate, QS certificate above $2M, versioned and locked', status: 'live' },
      { name: 'Waterfall scenarios and plain-English deal summary', status: 'live' },
      { name: 'Six-dimension risk score and investor risk profile', status: 'live' },
      { name: 'Four-tier investor verification (proof of funds, endorsement)', status: 'live' },
      { name: 'FEASO actuals vs forecast with 10% variance alerts', status: 'live' },
      { name: 'Completion valuation gate (admin verifies valuer registration manually)', status: 'live' },
      { name: 'Subcontractor stage scoring and milestone certificates', status: 'live' },
      { name: 'Contractor licence and insurance register (admin verifies against state register manually)', status: 'live' },
      { name: 'Drawdown gating (platform records the gate; it never holds or moves funds)', status: 'live' },
      { name: 'Automated licence lookup against state registers', status: 'not built' },
      { name: 'Breach register inside the platform', status: 'not built' }
    ],
    scheduledAutomations: [
      'Database backup every 6 hours', 'Lapse unconfirmed expressions of interest after 48 hours (hourly)', 'Licence and insurance expiry alerts, 30 days out and on expiry (daily)',
      'Wholesale certificate expiry check on access'
    ]
  });
});

app.post('/api/admin/regulators', requireAuth, requireAdmin, (req, res) => {
  const { fname, lname, email, password } = req.body;
  if (!fname || !email || !password || password.length < 10) return res.status(400).json({ error: 'Name, email and a password of at least 10 characters are required.' });
  const db = readDB();
  const e = String(email).toLowerCase().trim();
  if (db.users.find(u => u.email === e)) return res.status(400).json({ error: 'An account with this email already exists.' });
  db.users.push({ id: 'u-reg-' + Date.now(), email: e, password: hashPw(password), fname: String(fname).trim(), lname: String(lname || '').trim(), role: 'regulator', joined: new Date().toISOString() });
  writeDB(db);
  res.json({ ok: true });
});

// ── Partner Registry ──────────────────────────────
app.get('/api/partners/lookup', (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Code required.' });
  const db      = readDB();
  const partner = (db.partners || []).find(p => p.referralCode === code.toUpperCase() && p.active);
  if (!partner)  return res.status(404).json({ error: 'Referral code not found.' });
  res.json({ partner: { id: partner.id, name: partner.name, firm: partner.firm, role: partner.role } });
});

app.get('/api/admin/partners', requireAuth, requireAdmin, (req, res) => {
  const db = readDB();
  res.json({ partners: db.partners || [] });
});

app.post('/api/admin/partners', requireAuth, requireAdmin, (req, res) => {
  const db = readDB();
  if (!db.partners) db.partners = [];
  const { name, firm, role, email, phone, licenceNumber, agreementSigned, agreementDate, agreementNotes } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and role are required.' });

  const base = (name.split(' ')[0] + (firm ? '-' + firm.split(' ')[0] : '')).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const code = base + '-' + Math.random().toString(36).substring(2, 5).toUpperCase();

  const partner = {
    id:              'prt-' + Date.now(),
    name, firm: firm || '', role, email: email || '', phone: phone || '',
    licenceNumber:   licenceNumber || '',
    referralCode:    code,
    active:          true,
    agreementSigned: !!agreementSigned,
    agreementDate:   agreementDate || null,
    agreementNotes:  agreementNotes || '',
    createdAt:       new Date().toISOString(),
    referralCount:   0
  };
  db.partners.push(partner);
  writeDB(db);
  res.json({ ok: true, partner });
});

app.post('/api/admin/partners/:id/toggle', requireAuth, requireAdmin, (req, res) => {
  const db = readDB();
  const p  = (db.partners || []).find(p => p.id === req.params.id);
  if (!p)  return res.status(404).json({ error: 'Partner not found.' });
  p.active = !p.active;
  writeDB(db);
  res.json({ ok: true, partner: p });
});

// ── Risk Declarations ─────────────────────────────
app.post('/api/risk-declaration', requireAuth, (req, res) => {
  const db   = readDB();
  if (!db.riskDeclarations) db.riskDeclarations = [];
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { listingId, listingName, referringPartnerCode, allChecksConfirmed, waterfallAcknowledged, summaryAcknowledged } = req.body;
  if (!allChecksConfirmed) return res.status(400).json({ error: 'All risk confirmations required.' });
  if (!summaryAcknowledged) return res.status(400).json({ error: 'Please read the plain-English deal summary first.' });
  if (!waterfallAcknowledged) return res.status(400).json({ error: 'Please acknowledge the waterfall scenarios first.' });

  let referringPartner = null;
  if (referringPartnerCode) {
    referringPartner = (db.partners || []).find(p => p.referralCode === referringPartnerCode && p.active);
    if (referringPartner) referringPartner.referralCount = (referringPartner.referralCount || 0) + 1;
  }
  if (!referringPartner && user.referredBy) {
    referringPartner = (db.partners || []).find(p => p.referralCode === user.referredBy);
  }

  const listing = db.listings.find(l => l.id === listingId);
  const decl = {
    id:                    'rd-' + Date.now(),
    userId:                req.session.userId,
    userEmail:             user.email,
    userName:              (user.fname + ' ' + (user.lname || '')).trim(),
    listingId:             listingId || null,
    listingName:           listing?.name || listingName || '—',
    referringPartnerId:    referringPartner?.id   || null,
    referringPartnerName:  referringPartner?.name || null,
    referringPartnerFirm:  referringPartner?.firm || null,
    referringPartnerRole:  referringPartner?.role || null,
    allChecksConfirmed:    true,
    summaryAcknowledged:   true,
    waterfallAcknowledged: true,
    ipAddress:             req.ip,
    declaredAt:            new Date().toISOString()
  };
  db.riskDeclarations.push(decl);
  const userIdx = db.users.findIndex(u => u.id === req.session.userId);
  if (userIdx !== -1) db.users[userIdx].riskDeclaredAt = decl.declaredAt;
  writeDB(db);
  res.json({ ok: true, declaration: decl });
});

app.get('/api/admin/risk-declarations', requireAuth, requireAdmin, (req, res) => {
  const db    = readDB();
  const decls = (db.riskDeclarations || []).slice().reverse();
  res.json({ declarations: decls });
});

// ── Admin: Users list ─────────────────────────────
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const db = readDB();
  const users = db.users.map(({ password: _, ...u }) => u);
  res.json({ users });
});

// ── Health check ──────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, version: '2.0.0', ts: new Date().toISOString() }));

// ── Feature modules (cooling-off EOIs, FEASO, valuation, actuals, tiers,
//    contractors, drawdowns, directories) ──
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
require('./features')(app, {
  readDB, writeDB, requireAuth, requireDev, requireAdmin, requireRegulator, sendEmail, esc,
  BASE_URL, ADMIN_EMAIL, UPLOAD_DIR, DATA_DIR, DB_FILE, BACKUP_DIR,
  multer, rateLimit, crypto, fs, path,
  parseNum, round1, dealFigures, computeRisk, publicListing, finRow,
  contractorCompliance, docStatus, investorTier, tierAtLeast, TIER_RANK,
  smtpConfigured: () => !!mailer
});

// ── SPA fallback — serve React index.html for all non-API routes ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found');
  }
});

// ── Start ─────────────────────────────────────────
readDB();   // Ensure DB exists on startup
migrateDemoData();
backupDB(); // Take initial backup

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   🧬  Prop Dev DNA Server v2.0        ║');
  console.log(`  ║   Open:  http://localhost:${PORT}       ║`);
  console.log('  ║   bcrypt ✅  rate-limit ✅  backup ✅  ║');
  console.log('  ║   Press Ctrl+C to stop               ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});
