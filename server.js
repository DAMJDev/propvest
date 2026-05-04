// ═══════════════════════════════════════════════════
//  PropVest — Backend Server
//  Express + JSON file database + session auth
// ═══════════════════════════════════════════════════
const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// ── Middleware ─────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'propvest-secret-2026-xK9mP',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' }
}));

// ── Default listing data ───────────────────────────
const DEFAULT_LISTINGS = [
  {
    id:'hvr-001', type:'residential', badge:'NEW LISTING', badgeClass:'',
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
    id:'cse-002', type:'commercial', badge:'LIMITED SPOTS', badgeClass:'limited',
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
    id:'rq-003', type:'mixed', badge:'OPEN', badgeClass:'',
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
    id:'pp-004', type:'residential', badge:'OPEN', badgeClass:'',
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

// ── Database helpers ───────────────────────────────
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
      { id:'u-demo-dev', email:'developer@demo.com', password: hashPw('demo123'), fname:'Sam', lname:'Demo', role:'developer', joined: new Date().toISOString() }
    ],
    listings: DEFAULT_LISTINGS,
    interests: []
  };
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
  writeDB(data);
  console.log('✅ Database seeded with demo accounts and 4 default listings.');
  return data;
}

function hashPw(pw) {
  return crypto.createHash('sha256').update(pw + 'propvest-salt').digest('hex');
}

// ── Auth middleware ────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireDev(req, res, next) {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'developer') return res.status(403).json({ error: 'Developer account required' });
  next();
}

// ══════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════

// ── Auth ──────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { fname, lname, email, password, role } = req.body;
  if (!fname || !email || !password || !role) return res.status(400).json({ error: 'All fields required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!['investor','developer'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });

  const db = readDB();
  if (db.users.find(u => u.email === email.toLowerCase())) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }
  const user = {
    id: 'u-' + Date.now(),
    email: email.toLowerCase().trim(),
    password: hashPw(password),
    fname: fname.trim(),
    lname: (lname || '').trim(),
    role,
    joined: new Date().toISOString()
  };
  db.users.push(user);
  writeDB(db);
  req.session.userId = user.id;
  const { password: _, ...safeUser } = user;
  res.json({ ok: true, user: safeUser });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email?.toLowerCase()?.trim() && u.password === hashPw(password));
  if (!user) return res.status(401).json({ error: 'Incorrect email or password.' });
  req.session.userId = user.id;
  const { password: _, ...safeUser } = user;
  res.json({ ok: true, user: safeUser });
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
  res.json({ user: safeUser });
});

// ── Listings ──────────────────────────────────────
app.get('/api/listings', (req, res) => {
  const db = readDB();
  res.json(db.listings);
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
    id: 'lst-' + Date.now(),
    devId: req.session.userId,
    fundedPct: 0,
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
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  let interests = db.interests;

  if (user.role === 'developer') {
    // Developers see leads for their listings
    const myListingIds = new Set(db.listings.filter(l => l.devId === user.id).map(l => l.id));
    interests = interests.filter(i => myListingIds.has(i.listingId));
  } else {
    // Investors see their own submissions
    interests = interests.filter(i => i.userId === user.id);
  }
  res.json(interests);
});

app.post('/api/interests', (req, res) => {
  const db = readDB();
  const { listingId, fname, lname, email, phone, amount, comments, needsBroker } = req.body;
  if (!listingId || !fname || !email) return res.status(400).json({ error: 'Missing required fields.' });

  const listing = db.listings.find(l => l.id === listingId);
  const refCode = 'REF-' + new Date().getFullYear() + '-' + (listingId || 'GEN').toUpperCase().slice(0,3) + '-' + Math.floor(Math.random()*9000+1000);

  const interest = {
    id: 'int-' + Date.now(),
    listingId, listingName: listing?.name || '—',
    fname, lname, email, phone, amount, comments,
    needsBroker: !!needsBroker,
    refCode,
    userId: req.session.userId || null,
    createdAt: new Date().toISOString()
  };
  db.interests.push(interest);
  writeDB(db);
  res.json({ ok: true, interest });
});

// ── Stats ─────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const db = readDB();
  res.json({
    listings: db.listings.length,
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
  const db = readDB();
  const idx = db.listings.findIndex(l => l.id === req.params.id && l.devId === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found or not yours.' });
  db.listings[idx].feaso = { ...req.body, updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ ok: true, feaso: db.listings[idx].feaso });
});

// ── Health check ──────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, version: '1.0.0' }));

// ── Start ─────────────────────────────────────────
readDB(); // Ensure DB exists
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   🏛  PropVest Server Running         ║');
  console.log(`  ║   Open:  http://localhost:${PORT}       ║`);
  console.log('  ║   Press Ctrl+C to stop               ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});
