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
const DB_FILE    = path.join(__dirname, 'data', 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
[UPLOAD_DIR, BACKUP_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Admin credentials (override via env vars) ─────
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
      Prop Dev DNA · Australia · <a href="https://propdevdna.com.au" style="color:#c9a84c">propdevdna.com.au</a><br>
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
    devId:'system', createdAt: new Date().toISOString()
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

function seedDB() {
  const data = {
    users: [
      { id:'u-demo-inv', email:'investor@demo.com', password: hashPw('demo123'), fname:'Alex', lname:'Demo', role:'investor', joined: new Date().toISOString() },
      { id:'u-demo-dev', email:'developer@demo.com', password: hashPw('demo123'), fname:'Sam', lname:'Demo', role:'developer', joined: new Date().toISOString() },
      { id:'u-admin-001', email: ADMIN_EMAIL, password: hashPw(ADMIN_PASSWORD), fname:'Anthony', lname:'Admin', role:'admin', joined: new Date().toISOString() }
    ],
    listings: DEFAULT_LISTINGS,
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
  const { fname, lname, email, password, role, referralCode } = req.body;
  if (!fname || !email || !password || !role) return res.status(400).json({ error: 'All fields required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!['investor','developer'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });

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
    ${role === 'investor' ? `<p style="color:#888;line-height:1.7">Your next step is to complete your <strong style="color:#c9a84c">Wholesale Investor Certification</strong> (s761G Corporations Act). Once approved, you'll have full access to all Investment Memorandums and FEASO reports.</p>` : `<p style="color:#888;line-height:1.7">Upgrade to a Developer subscription to publish listings and generate Information Memorandums for wholesale investors.</p>`}
    <a href="https://propdevdna.com.au" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Go to Platform →</a>
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
  res.json({ ok: true, user: { ...safeUser, activeSubscriptions: activePlans } });
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
  res.json({ user: { ...safeUser, activeSubscriptions: activePlans } });
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

  res.json(listings);
});

app.get('/api/listings/:id', (req, res) => {
  const db = readDB();
  const listing = db.listings.find(l => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  res.json(listing);
});

app.post('/api/listings', requireAuth, requireDev, (req, res) => {
  const db = readDB();
  const listing = {
    ...req.body,
    id:        'lst-' + Date.now(),
    devId:     req.session.userId,
    fundedPct: 0,
    status:    'draft',              // starts as draft — goes live after IM approval
    createdAt: new Date().toISOString()
  };
  db.listings.unshift(listing);
  writeDB(db);
  res.json({ ok: true, listing });
});

app.put('/api/listings/:id', requireAuth, requireDev, (req, res) => {
  const db = readDB();
  const idx = db.listings.findIndex(l => l.id === req.params.id && l.devId === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  db.listings[idx] = { ...db.listings[idx], ...req.body, id: req.params.id };
  writeDB(db);
  res.json({ ok: true, listing: db.listings[idx] });
});

app.delete('/api/listings/:id', requireAuth, requireDev, (req, res) => {
  const db = readDB();
  const idx = db.listings.findIndex(l => l.id === req.params.id && l.devId === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  db.listings.splice(idx, 1);
  writeDB(db);
  res.json({ ok: true });
});

// ── Interests / Leads ─────────────────────────────
app.get('/api/interests', requireAuth, (req, res) => {
  const db   = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  let interests = db.interests;

  if (user.role === 'developer') {
    const myIds = new Set(db.listings.filter(l => l.devId === user.id).map(l => l.id));
    interests = interests.filter(i => myIds.has(i.listingId));
  } else if (user.role !== 'admin') {
    interests = interests.filter(i => i.userId === user.id);
  }
  res.json(interests);
});

app.post('/api/interests', (req, res) => {
  const db = readDB();
  const { listingId, fname, lname, email, phone, amount, comments, needsBroker } = req.body;
  if (!listingId || !fname || !email) return res.status(400).json({ error: 'Missing required fields.' });

  const listing = db.listings.find(l => l.id === listingId);
  const refCode = 'REF-' + new Date().getFullYear() + '-' + (listingId || 'GEN').toUpperCase().slice(0, 3) + '-' + Math.floor(Math.random() * 9000 + 1000);

  const interest = {
    id: 'int-' + Date.now(),
    listingId, listingName: listing?.name || '—',
    fname, lname, email, phone, amount, comments,
    needsBroker: !!needsBroker,
    refCode,
    userId:    req.session.userId || null,
    createdAt: new Date().toISOString()
  };
  db.interests.push(interest);
  writeDB(db);

  // Notify developer of new lead
  if (listing && listing.devId !== 'system') {
    const dev = db.users.find(u => u.id === listing.devId);
    if (dev) {
      sendEmail(dev.email, `New investor enquiry — ${listing.name}`, `
        <p style="color:#888">You have a new investor enquiry on <strong style="color:#c9a84c">${listing.name}</strong>.</p>
        <p style="color:#888"><strong style="color:#e8e2d5">Name:</strong> ${fname} ${lname || ''}<br>
        <strong style="color:#e8e2d5">Email:</strong> ${email}<br>
        <strong style="color:#e8e2d5">Phone:</strong> ${phone || 'Not provided'}<br>
        <strong style="color:#e8e2d5">Proposed amount:</strong> ${amount || 'Not specified'}<br>
        <strong style="color:#e8e2d5">Ref:</strong> ${refCode}</p>
        <a href="https://propdevdna.com.au" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View in Portal →</a>
      `);
    }
  }

  // Notify admin of new interest
  sendEmail(ADMIN_EMAIL, `New investor interest: ${fname} → ${listing?.name || listingId}`, `
    <p style="color:#888">Investor <strong style="color:#e8e2d5">${fname} ${lname || ''}</strong> (${email}) has expressed interest in <strong style="color:#c9a84c">${listing?.name || listingId}</strong>.<br>Amount: ${amount || 'unspecified'} · Ref: ${refCode}</p>
  `);

  res.json({ ok: true, interest });
});

// ── Stats ─────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const db = readDB();
  res.json({
    listings:  db.listings.filter(l => l.status === 'active').length,
    investors: db.users.filter(u => u.role === 'investor').length,
    interests: db.interests.length
  });
});

// ── FEASO ─────────────────────────────────────────
app.get('/api/listings/:id/feaso', (req, res) => {
  const db = readDB();
  const listing = db.listings.find(l => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  res.json(listing.feaso || null);
});

app.post('/api/listings/:id/feaso', requireAuth, requireDev, (req, res) => {
  const db  = readDB();
  const idx = db.listings.findIndex(l => l.id === req.params.id && l.devId === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  db.listings[idx].feaso = { ...req.body, updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ ok: true, feaso: db.listings[idx].feaso });
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
    <a href="https://propdevdna.com.au" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Go to Portal →</a>
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
      <a href="https://propdevdna.com.au" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Live Listing →</a>
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
      <a href="https://propdevdna.com.au" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Go to Portal →</a>
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

    res.json({ ok: true, cert });
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
  res.json({ cert: latest, wholesaleStatus: user?.wholesaleStatus || 'none', wsOk: wsStatus.ok });
});

app.get('/api/admin/wholesale-certs', requireAuth, requireAdmin, (req, res) => {
  const db    = readDB();
  const certs = (db.wholesaleCerts || []).slice().reverse();
  res.json({ certs });
});

app.post('/api/admin/wholesale-certs/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const db   = readDB();
  if (!db.wholesaleCerts) return res.status(404).json({ error: 'Not found.' });
  const cert = db.wholesaleCerts.find(c => c.id === req.params.id);
  if (!cert)  return res.status(404).json({ error: 'Certificate not found.' });

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
      <a href="https://propdevdna.com.au" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Browse Investment Opportunities →</a>
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
      <a href="https://propdevdna.com.au" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Resubmit Certificate →</a>
    `);
  }

  res.json({ ok: true, cert });
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

  const { listingId, listingName, referringPartnerCode, allChecksConfirmed } = req.body;
  if (!allChecksConfirmed) return res.status(400).json({ error: 'All risk confirmations required.' });

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

// ── Health check ──────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, version: '2.0.0', ts: new Date().toISOString() }));

// ── Start ─────────────────────────────────────────
readDB();   // Ensure DB exists on startup
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
