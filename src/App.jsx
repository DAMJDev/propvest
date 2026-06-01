import { useState, useEffect } from "react";

// ─── API LAYER ────────────────────────────────────────────────────
const API = {
  get: (url) => fetch(url, { credentials: 'include' }).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) }).then(r => r.json()),
};

// ─── INVESTOR VERIFICATION TIERS ─────────────────────────────────
const TIERS = {
  registered:   { label: "Registered",        badge: "🔵", color: "#2980B9", bg: "rgba(41,128,185,0.08)",  border: "rgba(41,128,185,0.25)",  desc: "Email verified" },
  verified:     { label: "Wholesale Verified", badge: "🟡", color: "#C9A84C", bg: "rgba(201,168,76,0.08)",  border: "rgba(201,168,76,0.3)",   desc: "s.761G accountant certificate approved" },
  funds:        { label: "Capital Ready",      badge: "🟢", color: "#27AE60", bg: "rgba(39,174,96,0.08)",   border: "rgba(39,174,96,0.3)",    desc: "Proof of funds verified by platform" },
  prequalified: { label: "PDD Endorsed",       badge: "⭐", color: "#C9A84C", bg: "rgba(201,168,76,0.12)",  border: "rgba(201,168,76,0.5)",   desc: "Pre-qualified by Anthony Lawson — broker verified" },
};

const PROOF_TYPES = [
  "Bank / brokerage account statement (last 90 days)",
  "SMSF trustee balance statement",
  "Mortgage offset account statement",
  "Term deposit certificate",
  "Solicitor's trust account confirmation letter",
  "Line of credit / facility approval letter",
  "Share portfolio statement",
  "Other — described in notes",
];

const FILTERS = ["All","NSW","VIC","QLD","DA Approved","Construction","Pre-DA","High Yield (>20%)"];


// ─── LISTING IMAGES ──────────────────────────────────────────────
// High-quality Unsplash architectural photography — free to use
const LISTING_IMAGES = {
  residential: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80&fit=crop',
  boutique:    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80&fit=crop',
  mixed:       'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800&q=80&fit=crop',
  beach:       'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&q=80&fit=crop',
  townhouse:   'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80&fit=crop',
  land:        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80&fit=crop',
  heritage:    'https://images.unsplash.com/photo-1464938050520-ef2270bb8ce8?w=800&q=80&fit=crop',
  commercial:  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80&fit=crop',
  luxury:      'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80&fit=crop',
  highrise:    'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80&fit=crop',
  penthouse:   'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80&fit=crop',
  default:     'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80&fit=crop',
};

function getListingImage(l) {
  const type = (l.type || '').toLowerCase();
  const name = (l.name || l.title || '').toLowerCase();
  const loc  = (l.loc || l.suburb || '').toLowerCase();

  if (name.includes('beach') || name.includes('coast') || name.includes('dune') || name.includes('pacifico') || loc.includes('gold coast') || loc.includes('mermaid'))
    return LISTING_IMAGES.beach;
  if (name.includes('penthouse') || name.includes('pacifico'))
    return LISTING_IMAGES.penthouse;
  if (name.includes('harbour') || name.includes('view') || name.includes('sky'))
    return LISTING_IMAGES.highrise;
  if (name.includes('heritage') || name.includes('collingwood') || name.includes('exchange') || name.includes('reuse'))
    return LISTING_IMAGES.heritage;
  if (name.includes('park') || name.includes('garden') || name.includes('quarter') || name.includes('riverside'))
    return LISTING_IMAGES.boutique;
  if (type.includes('mixed') || type.includes('retail'))
    return LISTING_IMAGES.mixed;
  if (type.includes('town') || type.includes('terrace'))
    return LISTING_IMAGES.townhouse;
  if (type.includes('land') || type.includes('subdiv'))
    return LISTING_IMAGES.land;
  if (type.includes('commercial') || type.includes('office'))
    return LISTING_IMAGES.commercial;
  if (type.includes('luxury') || (l.minInvest && l.minInvest >= 1000000))
    return LISTING_IMAGES.luxury;
  return LISTING_IMAGES.residential;
}

// ─── LISTING FIELD NORMALISER ────────────────────────────────────
function parseMoney(v) {
  if (!v && v !== 0) return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function parseIRR(v) {
  if (!v && v !== 0) return '—';
  if (typeof v === 'number') return `${v}%`;
  return String(v).includes('%') ? String(v) : `${v}%`;
}

function parseTerm(v) {
  if (!v) return '—';
  return String(v);
}

function parseState(l) {
  if (l.state) return l.state;
  const loc = l.loc || l.location || l.address || '';
  if (loc.includes('NSW')) return 'NSW';
  if (loc.includes('VIC')) return 'VIC';
  if (loc.includes('QLD')) return 'QLD';
  if (loc.includes('WA'))  return 'WA';
  if (loc.includes('SA'))  return 'SA';
  return 'NSW';
}

function parseSuburb(l) {
  if (l.suburb) return l.suburb;
  const loc = l.loc || l.location || '';
  return loc.replace(/^📍\s*/, '').replace(/\s*(NSW|VIC|QLD|WA|SA|ACT)$/, '').trim() || loc;
}

function normaliseListing(l) {
  const raise     = parseMoney(l.raise || l.capitalRaise || l.capital_raise || l.raiseTarget);
  const minInvest = parseMoney(l.minInvest || l.minimumInvestment || l.minimum_investment || l.minInvestment) || 50000;
  const funded    = typeof l.fundedPct === 'number' ? l.fundedPct : null;
  const raised    = parseMoney(l.raised || l.capitalRaised || l.capital_raised)
                    || (raise && funded !== null ? Math.round(raise * funded / 100) : 0);

  return {
    ...l,
    name:      l.name || l.title || l.projectName || 'Untitled Project',
    type:      l.type || l.propertyType || l.developmentType || 'Development',
    state:     parseState(l),
    suburb:    parseSuburb(l),
    stage:     l.stage || l.status || l.badge || 'Active',
    irr:       parseIRR(l.irr || l.targetIRR || l.target_irr),
    term:      parseTerm(l.term || l.hold || l.investmentTerm),
    minInvest,
    raise,
    raised,
    equity:    l.equity || l.equityRequired || '—',
    ltv:       l.ltv || l.lvr || l.LVR || '—',
    structure: l.structure || l.investmentStructure || '—',
    desc:      l.desc || l.description || l.overview || l.projectDescription || '',
    highlights:l.highlights || l.keyHighlights || l.key_highlights || [],
    developer: l.developer || l.developerName || l.developer?.name || l.developerInfo?.name || '',
    units:     l.units || l.totalUnits || l.numUnits || l.lots || l.stats?.[0]?.[0] || 0,
    emoji:     l.emoji || '🏗️',
    imageUrl:  (() => { const picsumOrEmpty = !l.photo || l.photo.includes('picsum') || l.photo.includes('placeholder'); return picsumOrEmpty ? getListingImage({...l, minInvest: parseMoney(l.minInvest || l.minimumInvestment) || 50000}) : (l.imageUrl || l.photo || l.heroPhoto); })(),
  };
}



// ─── CSS ─────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--gold:#C9A84C;--ink:#0D0D0D;--paper:#F5F2EC;--sage:#2A3A2E;--muted:#6B6B5A}
  body{font-family:'DM Sans',sans-serif;background:var(--paper);color:var(--ink);overflow-x:hidden;-webkit-font-smoothing:antialiased}
  .notice{background:rgba(201,168,76,0.08);border-bottom:1px solid rgba(201,168,76,0.2);padding:12px 40px;text-align:center;font-size:13px;color:rgba(13,13,13,0.6)}
  .notice strong{color:var(--gold)}
  nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 48px;height:220px;background:rgba(13,13,13,0.98);backdrop-filter:blur(16px);border-bottom:1px solid rgba(201,168,76,0.1)}
  .logo{cursor:pointer;background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding:0}
  .logo-text{display:none}
  .logo-name{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:var(--gold);line-height:1;letter-spacing:0.5px}
  .logo-slogan{font-size:14px;color:rgba(201,168,76,0.8);letter-spacing:3px;margin-top:6px;text-transform:uppercase;font-family:'DM Sans',sans-serif;font-weight:300;text-align:center;white-space:nowrap}
  .nav-links{display:flex;align-items:center;gap:36px}
  .nl{color:rgba(245,242,236,0.75);font-size:32px;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;transition:color 0.2s;padding:0;letter-spacing:0.5px}
  .nl:hover{color:var(--gold)}
  .nl.cta{background:var(--gold);color:var(--ink);font-size:26px;font-weight:500;letter-spacing:2px;text-transform:uppercase;padding:12px 28px}
  .nl.cta:hover{opacity:0.85}
  .hamburger{display:none;flex-direction:column;justify-content:center;gap:5px;background:none;border:none;cursor:pointer;padding:8px;z-index:110}
  .hamburger span{display:block;width:22px;height:2px;background:rgba(245,242,236,0.7);transition:all 0.25s}
  .hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
  .hamburger.open span:nth-child(2){opacity:0}
  .hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
  .mobile-menu{display:none;position:absolute;top:100%;left:0;right:0;background:rgba(13,13,13,0.98);border-bottom:1px solid rgba(201,168,76,0.15);padding:16px 0;flex-direction:column;z-index:99}
  .mobile-menu.open{display:flex}
  .mobile-menu .nl{padding:12px 32px;font-size:14px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.04)}
  .mobile-menu .nl.cta{margin:12px 32px 4px;padding:10px 18px;text-align:center}
  @media(max-width:768px){
    nav{padding:0 20px;height:80px;position:relative}
    .nav-links{display:none}
    .hamburger{display:flex}
  }
  .hero{min-height:100vh;background:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px;position:relative;overflow:hidden}
  .hgrid{position:absolute;inset:0;opacity:0.03;background-image:linear-gradient(var(--gold) 1px,transparent 1px),linear-gradient(90deg,var(--gold) 1px,transparent 1px);background-size:60px 60px}
  .hglow{position:absolute;top:25%;left:50%;transform:translateX(-50%);width:500px;height:250px;background:radial-gradient(ellipse,rgba(201,168,76,0.06) 0%,transparent 70%);pointer-events:none}
  .badge-hero{display:inline-flex;align-items:center;gap:7px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.22);color:var(--gold);font-size:9px;letter-spacing:3px;text-transform:uppercase;padding:6px 16px;margin-bottom:32px}
  .bdot{width:5px;height:5px;background:var(--gold);border-radius:50%;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
  .h1{font-family:'Cormorant Garamond',serif;font-size:clamp(40px,7vw,80px);font-weight:600;color:#fff;line-height:0.93;margin-bottom:20px;letter-spacing:-1px}
  .h1 em{color:var(--gold);font-style:italic}
  .hsub{font-size:14px;color:rgba(245,242,236,0.45);max-width:460px;line-height:1.75;margin-bottom:40px;font-weight:300}
  .hbtns{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
  .btn{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;padding:12px 28px;border:none;cursor:pointer;transition:all 0.2s}
  .btn-g{background:var(--gold);color:var(--ink)}.btn-g:hover{opacity:0.85;transform:translateY(-1px)}
  .btn-o{background:transparent;color:rgba(245,242,236,0.7);border:1px solid rgba(245,242,236,0.15)}.btn-o:hover{border-color:var(--gold);color:var(--gold)}
  .btn-d{background:var(--ink);color:var(--paper)}.btn-d:hover{opacity:0.85}
  .btn-sm{padding:8px 18px;font-size:9px}
  .hstats{display:flex;gap:48px;margin-top:60px;padding-top:36px;border-top:1px solid rgba(201,168,76,0.1);flex-wrap:wrap;justify-content:center}
  .sn{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:600;color:var(--gold);line-height:1}
  .sl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(245,242,236,0.28);margin-top:4px}
  sec{display:block;padding:72px 32px}
  .slbl{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
  .stitle{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,4vw,46px);font-weight:600;line-height:1.1;margin-bottom:16px}
  .ssub{font-size:13px;color:var(--muted);line-height:1.75;max-width:500px;font-weight:300}
  .how-sec{background:var(--ink)}
  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(201,168,76,0.07);margin-top:48px}
  .step{background:var(--ink);padding:36px 28px}
  .stn{font-family:'Cormorant Garamond',serif;font-size:56px;color:rgba(201,168,76,0.08);line-height:1;margin-bottom:16px}
  .sti{font-size:24px;margin-bottom:12px}
  .step h3{font-family:'Cormorant Garamond',serif;font-size:20px;color:#fff;margin-bottom:8px}
  .step p{font-size:12px;color:rgba(245,242,236,0.37);line-height:1.7;font-weight:300}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-top:32px}
  .card{background:#fff;border:1px solid rgba(0,0,0,0.07);overflow:hidden;cursor:pointer;transition:all 0.22s}
  .card:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(0,0,0,0.12);border-color:var(--gold)}.card:hover .cimg img{transform:scale(1.05)}.card .cimg img{transition:transform 0.5s ease}
  .cimg{height:220px;position:relative;overflow:hidden}
  .cstage{position:absolute;top:10px;left:10px;background:var(--ink);color:var(--gold);font-size:8px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px}
  .cbody{padding:16px}
  .ctype{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:5px}
  .cname{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;margin-bottom:2px}
  .cloc{font-size:11px;color:var(--muted);margin-bottom:14px}
  .cmets{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(0,0,0,0.06);padding-top:12px}
  .cm{text-align:center}
  .cm:not(:last-child){border-right:1px solid rgba(0,0,0,0.06)}
  .cmv{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:600}
  .cml{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-top:1px}
  .pw{margin-top:14px}
  .pls{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-bottom:4px}
  .pb{height:2px;background:rgba(0,0,0,0.07)}
  .pfill{height:100%;background:var(--gold)}
  .closing{background:rgba(201,168,76,0.05);border:1px solid rgba(201,168,76,0.18);padding:6px 10px;margin-top:10px;font-size:10px;color:var(--gold)}
  .filters{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:24px}
  .fb{background:transparent;border:1px solid rgba(0,0,0,0.1);color:var(--muted);font-size:10px;letter-spacing:0.8px;text-transform:uppercase;padding:6px 14px;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif}
  .fb.on,.fb:hover{background:var(--ink);border-color:var(--ink);color:var(--paper)}
  .dh{min-height:40vh;display:flex;align-items:flex-end;padding:72px 32px 36px;position:relative}
  .dback{position:absolute;top:72px;left:32px;background:none;border:1px solid rgba(245,242,236,0.14);color:rgba(245,242,236,0.55);font-size:10px;letter-spacing:1px;padding:6px 16px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s}
  .dback:hover{border-color:var(--gold);color:var(--gold)}
  .dh1{font-family:'Cormorant Garamond',serif;font-size:clamp(32px,5vw,60px);font-weight:600;color:#fff;line-height:1;margin-bottom:8px}
  .dbody{display:grid;grid-template-columns:1fr 340px;gap:36px;padding:36px 32px}
  .dmets{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(0,0,0,0.07);margin-bottom:36px}
  .dmet{background:var(--paper);padding:18px}
  .dmetv{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600}
  .dmetl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-top:3px}
  .dsec h2{font-family:'Cormorant Garamond',serif;font-size:24px;margin-bottom:12px}
  .dsec p{font-size:13px;color:#444;line-height:1.8;margin-bottom:12px}
  .hlist{list-style:none;margin-top:6px}
  .hlist li{font-size:12px;color:#333;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05);display:flex;gap:9px}
  .hlist li::before{content:"✓";color:var(--gold);font-weight:bold;flex-shrink:0}
  .sbar{position:sticky;top:64px;height:fit-content}
  .sc{background:var(--ink);padding:32px}
  .sc h3{font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--paper);margin-bottom:5px}
  .sc>p{font-size:11px;color:rgba(245,242,236,0.38);margin-bottom:20px;line-height:1.6}
  .si{display:flex;justify-content:space-between;font-size:11px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
  .sil{color:rgba(245,242,236,0.32)}.siv{color:var(--paper);font-weight:500}
  .sdis{font-size:9px;color:rgba(245,242,236,0.18);margin-top:12px;line-height:1.6}
  .portal{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
  .pfeats{list-style:none;margin-top:24px}
  .pf2{display:flex;align-items:flex-start;gap:12px;padding:16px 0;border-bottom:1px solid rgba(0,0,0,0.07)}
  .pfi{width:32px;height:32px;background:var(--sage);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px}
  .pf2 h4{font-size:13px;font-weight:500;margin-bottom:2px}
  .pf2 p{font-size:11px;color:var(--muted);line-height:1.6}
  .pform{background:var(--ink);padding:40px}
  .pform h3{font-family:'Cormorant Garamond',serif;font-size:24px;color:var(--paper);margin-bottom:5px}
  .pform>p{font-size:11px;color:rgba(245,242,236,0.38);margin-bottom:24px}
  .fg{margin-bottom:16px}
  .fl{display:block;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(245,242,236,0.42);margin-bottom:6px}
  .fi{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.16);color:var(--paper);font-size:12px;padding:10px 13px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color 0.2s}
  .fi:focus{border-color:var(--gold)}
  .fi::placeholder{color:rgba(245,242,236,0.16)}
  select.fi option{background:var(--ink)}
  .snote{background:rgba(201,168,76,0.07);border:1px solid rgba(201,168,76,0.18);padding:12px;margin-top:14px;font-size:10px;color:rgba(201,168,76,0.75);line-height:1.6}
  .pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(201,168,76,0.07);margin-top:44px}
  .pc{background:var(--ink);padding:40px 32px;position:relative}
  .pc.feat{background:#0f0f0f}
  .pc.feat::before{content:'Most Popular';position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:var(--gold);color:var(--ink);font-size:8px;letter-spacing:2px;text-transform:uppercase;padding:3px 12px;font-weight:500}
  .pplan{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:16px}
  .pprice{font-family:'Cormorant Garamond',serif;font-size:44px;font-weight:600;color:var(--paper);line-height:1}
  .pper{font-size:10px;color:rgba(245,242,236,0.22);margin-bottom:24px;margin-top:2px}
  .pfl{list-style:none;margin-bottom:32px}
  .pfl li{font-size:11px;color:rgba(245,242,236,0.48);padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;gap:8px}
  .pfl li::before{content:"✓";color:var(--gold);flex-shrink:0}
  .pfl li.off{color:rgba(245,242,236,0.18)}.pfl li.off::before{content:"–";color:rgba(245,242,236,0.13)}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
  .modal{background:var(--ink);max-width:540px;width:100%;padding:36px;border:1px solid rgba(201,168,76,0.16);max-height:88vh;overflow-y:auto}
  .mlbl{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
  .modal h2{font-family:'Cormorant Garamond',serif;font-size:26px;color:var(--paper);margin-bottom:12px}
  .modal p{font-size:11px;color:rgba(245,242,236,0.42);line-height:1.8;margin-bottom:12px}
  .matns{display:flex;gap:8px;margin-top:24px}
  .ri{background:rgba(255,255,255,0.03);border-left:2px solid rgba(201,168,76,0.28);padding:9px 12px;margin-bottom:7px;font-size:11px;color:rgba(245,242,236,0.45);line-height:1.6}
  .ri strong{color:rgba(245,242,236,0.75)}
  .cr{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer}
  .cr input{margin-top:2px;accent-color:var(--gold);flex-shrink:0}
  .cr label{font-size:11px;color:rgba(245,242,236,0.45);line-height:1.6;cursor:pointer}
  .atabs{display:flex;margin-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.06)}
  .atab{flex:1;padding:10px;background:none;border:none;color:rgba(245,242,236,0.3);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;font-family:'DM Sans',sans-serif;border-bottom:2px solid transparent;transition:all 0.2s;margin-bottom:-1px}
  .atab.on{color:var(--gold);border-bottom-color:var(--gold)}
  .eoiopt{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);padding:12px;cursor:pointer;transition:all 0.2s;margin-bottom:6px}
  .eoiopt.sel{background:rgba(201,168,76,0.07);border-color:var(--gold)}
  .eoiopt-t{font-size:12px;color:var(--paper);font-weight:500}
  .eoiopt-s{font-size:10px;color:rgba(245,242,236,0.32)}
  .toast{position:fixed;bottom:24px;right:24px;background:var(--sage);color:#fff;padding:12px 18px;font-size:11px;z-index:300;border-left:3px solid var(--gold);animation:si 0.3s ease;max-width:280px;line-height:1.5}
  @keyframes si{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
  .about-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
  .aphoto{width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,var(--sage),#1a2a1e);display:flex;align-items:center;justify-content:center;font-size:72px}
  .acred{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.07)}
  .acred-i{font-size:18px}
  .acred-t{font-size:12px;color:#333}
  .acred-t strong{display:block;font-size:13px;color:var(--ink)}
  .dash-grid{display:grid;grid-template-columns:280px 1fr;gap:24px;align-items:start}
  .dash-sidebar{background:var(--ink);padding:28px}
  .tier-badge{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid;font-size:11px;font-weight:500;margin-bottom:20px;width:100%}
  .tier-progress{margin-top:24px}
  .tier-step{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
  .tier-step:last-child{border-bottom:none}
  .tier-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;margin-top:1px}
  .tier-dot.done{background:rgba(39,174,96,0.2);color:#27AE60}
  .tier-dot.active{background:rgba(201,168,76,0.2);color:var(--gold)}
  .tier-dot.pending{background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.2)}
  .tier-step-title{font-size:12px;color:var(--paper);font-weight:500;margin-bottom:3px}
  .tier-step-sub{font-size:10px;color:rgba(245,242,236,0.35);line-height:1.5}
  .dash-section{background:#fff;border:1px solid rgba(0,0,0,0.07);padding:24px;margin-bottom:16px}
  .dash-section h3{font-family:'Cormorant Garamond',serif;font-size:20px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid rgba(0,0,0,0.06)}
  .upload-zone{border:2px dashed rgba(201,168,76,0.3);padding:28px;text-align:center;cursor:pointer;transition:all 0.2s;background:rgba(201,168,76,0.02)}
  .upload-zone:hover{border-color:var(--gold);background:rgba(201,168,76,0.05)}
  .upload-icon{font-size:32px;margin-bottom:8px}
  .upload-text{font-size:12px;color:var(--muted);line-height:1.6}
  .upload-text strong{color:var(--ink);display:block;margin-bottom:4px}
  .doc-item{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f9f9f9;border:1px solid rgba(0,0,0,0.06);margin-bottom:6px}
  .doc-icon{font-size:20px}
  .doc-name{font-size:12px;color:var(--ink);font-weight:500;flex:1}
  .doc-status{font-size:10px;padding:3px 8px}
  .doc-status.pending{background:rgba(201,168,76,0.1);color:#997a1a}
  .doc-status.approved{background:rgba(39,174,96,0.1);color:#1a6b3a}
  .profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .profile-field{padding:12px;background:#f9f9f9;border:1px solid rgba(0,0,0,0.06)}
  .profile-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
  .profile-value{font-size:13px;color:var(--ink);font-weight:500}
  .watchlist-item{display:flex;align-items:center;gap:14px;padding:12px;border:1px solid rgba(0,0,0,0.07);margin-bottom:8px;cursor:pointer;transition:all 0.2s}
  .watchlist-item:hover{border-color:var(--gold)}
  .watchlist-emoji{font-size:28px}
  .watchlist-name{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:600;margin-bottom:2px}
  .watchlist-meta{font-size:11px;color:var(--muted)}
  .watchlist-irr{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--gold);margin-left:auto}
  .tiers-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(201,168,76,0.08);margin-top:48px}
  .tier-card{background:var(--ink);padding:32px 24px}
  footer{background:var(--ink);padding:48px 32px 24px;border-top:1px solid rgba(201,168,76,0.07)}
  .ftop{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:32px;margin-bottom:32px}
  .flogo{font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--gold);margin-bottom:10px}
  .ftag{font-size:11px;color:rgba(245,242,236,0.22);line-height:1.7;max-width:240px}
  .fch4{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(245,242,236,0.3);margin-bottom:16px}
  .fl2{display:block;font-size:11px;color:rgba(245,242,236,0.27);margin-bottom:8px;cursor:pointer;transition:color 0.2s;background:none;border:none;font-family:'DM Sans',sans-serif;text-align:left;padding:0}
  .fl2:hover{color:var(--gold)}
  .fbot{border-top:1px solid rgba(255,255,255,0.04);padding-top:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  .flegal{font-size:9px;color:rgba(245,242,236,0.16);line-height:1.8;max-width:620px}
  .fcopy{font-size:10px;color:rgba(245,242,236,0.16);white-space:nowrap}
  @media(max-width:900px){
    .steps,.portal,.pgrid,.about-grid,.ftop,.tiers-grid,.dash-grid{grid-template-columns:1fr}
    .dbody{grid-template-columns:1fr}
    .dmets{grid-template-columns:repeat(2,1fr)}
    .profile-grid{grid-template-columns:1fr}
    sec{padding:48px 20px}
    .dh{padding:64px 20px 28px}
    .dbody{padding:24px 20px}
  }
`;

// ─── HELPERS ─────────────────────────────────────────────────────
function PBar({ raised, target }) {
  if (!target || isNaN(target) || isNaN(raised)) return null;
  const pct = Math.min(100, Math.round(((raised || 0) / target) * 100));
  const fmt = v => {
    if (!v && v !== 0) return '—';
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v}`;
  };
  return (
    <div className="pw">
      <div className="pls"><span>{fmt(raised)} raised</span><span>{pct}% of {fmt(target)}</span></div>
      <div className="pb"><div className="pfill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function TierBadge({ tier, size = "sm" }) {
  const t = TIERS[tier] || TIERS.registered;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: size === "lg" ? 13 : 10, padding: size === "lg" ? "8px 14px" : "4px 8px", fontWeight: 500, whiteSpace: "nowrap" }}>
      {t.badge} {t.label}
    </span>
  );
}

function Card({ l, onClick }) {
  const closing = l.raise && l.raised && (l.raised / l.raise > 0.85);
  const imgUrl = l.imageUrl || l.image_url || l.coverImage || getListingImage(l);
  return (
    <div className="card" onClick={onClick}>
      <div className="cimg" style={{ position: 'relative', overflow: 'hidden', height: 220 }}>
        <img
          src={imgUrl}
          alt={l.name || l.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
          onError={e => { e.target.style.display = 'none'; e.target.parentNode.style.background = 'linear-gradient(135deg,#2A3A2E,#1a2a1e)'; }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
        <div className="cstage">{l.stage || l.status}</div>
        {l.state && <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(201,168,76,0.9)', color: '#0D0D0D', fontSize: 9, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px' }}>{l.state}</div>}
      </div>
      <div className="cbody">
        <div className="ctype">{l.type} · {l.state}</div>
        <div className="cname">{l.name || l.title}</div>
        <div className="cloc">📍 {l.suburb}, {l.state}</div>
        <div className="cmets">
          <div className="cm"><div className="cmv">{l.irr || '—'}</div><div className="cml">IRR</div></div>
          <div className="cm"><div className="cmv">{l.term || '—'}</div><div className="cml">Term</div></div>
          <div className="cm"><div className="cmv">{l.minInvest >= 1000000 ? `$${(l.minInvest/1e6).toFixed(1)}M` : `$${((l.minInvest||50000)/1000).toFixed(0)}K`}</div><div className="cml">Min.</div></div>
        </div>
        {l.raise && <PBar raised={l.raised || 0} target={l.raise} />}
        {closing && <div className="closing">⚡ Closing soon — {Math.round(100 - (l.raised / l.raise * 100))}% remaining</div>}
      </div>
    </div>
  );
}

// ─── COMPLIANCE MODAL ────────────────────────────────────────────
function CompModal({ listing, onAccept, onClose }) {
  const [checks, setChecks] = useState([false, false, false, false]);
  const ok = checks.every(Boolean);
  const tog = i => setChecks(c => c.map((v, j) => j === i ? !v : v));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="mlbl">Investor Risk Acknowledgment</div>
        <h2>Before You Proceed</h2>
        <p>Read and confirm all sections. Your declaration is logged with timestamp and IP address.</p>
        {[["Capital Loss Risk", "You may lose your entire investment. Property development carries substantial risk of total capital loss."],
          ["Illiquidity Risk", "This investment is illiquid. You may be unable to exit before the project completes."],
          ["No Financial Advice", "Nothing on this platform constitutes financial product advice. Seek independent advice before investing."],
          ["Wholesale Investor", "You confirm you meet s.761G criteria — net assets ≥ $2.5M or gross income ≥ $250K p.a. for 2 years."]
        ].map(([t, d], i) => (
          <div key={i} className="ri"><strong>⚠️ {t}</strong><br />{d}</div>
        ))}
        <div style={{ marginTop: 16 }}>
          {["I have read and understood all risk factors above.",
            "I accept this investment may fail and I may lose my entire capital.",
            "I am a wholesale investor under s.761G Corporations Act 2001.",
            "I take full personal responsibility for any investment decision I make."
          ].map((text, i) => (
            <div key={i} className="cr" onClick={() => tog(i)}>
              <input type="checkbox" checked={checks[i]} readOnly />
              <label>{text}</label>
            </div>
          ))}
        </div>
        <div className="matns">
          <button style={{ flex: 1, opacity: ok ? 1 : 0.4, cursor: ok ? 'pointer' : 'not-allowed', background: 'var(--gold)', color: 'var(--ink)', fontSize: '10px', fontWeight: '500', letterSpacing: '2px', textTransform: 'uppercase', padding: '12px 24px', border: 'none', fontFamily: "'DM Sans',sans-serif" }}
            onClick={ok ? onAccept : null}>Confirm & Continue →</button>
          <button className="btn btn-o" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── EOI MODAL ───────────────────────────────────────────────────
function EOIModal({ listing, onClose, toast, user }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ fn: user?.fname || '', ln: user?.lname || '', email: user?.email || '', phone: '', state: '', amount: '', fund: '', adv: '' });
  const [done, setDone] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    await API.post('/api/interests', { listingId: listing.id, ...f });
    setDone(true);
    toast('Interest submitted ✓');
  };

  if (done) return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <div className="mlbl">Interest Registered</div>
        <h2>{listing.name || listing.title}</h2>
        <p>Your expression of interest has been submitted. The team will be in touch within 24 hours.</p>
        <button className="btn btn-g" onClick={onClose}>Done</button>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="mlbl">Step {step} of 3 — {listing.name || listing.title}</div>
        <h2>{step === 1 ? 'Your Details' : step === 2 ? 'Investment Profile' : 'Review & Submit'}</h2>
        {step === 1 && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[['fn', 'First Name'], ['ln', 'Last Name']].map(([k, l]) => (
              <div className="fg" key={k}><label className="fl">{l}</label><input className="fi" value={f[k]} onChange={e => set(k, e.target.value)} /></div>
            ))}
          </div>
          <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={f.email} onChange={e => set('email', e.target.value)} /></div>
          <div className="fg"><label className="fl">Phone</label><input className="fi" type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div className="fg"><label className="fl">State</label>
            <select className="fi" value={f.state} onChange={e => set('state', e.target.value)}>
              <option value="">Select</option>
              {['NSW', 'VIC', 'QLD', 'WA', 'SA', 'ACT'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button className="btn btn-g" style={{ width: '100%', marginTop: 4 }} onClick={() => f.fn && f.email ? setStep(2) : null}>Continue →</button>
        </>}
        {step === 2 && <>
          <div className="fg"><label className="fl">Investment Amount</label>
            {['$250K–$500K', '$500K–$1M', '$1M–$2.5M', '$2.5M+', 'Still assessing'].map(a => (
              <div key={a} className={`eoiopt ${f.amount === a ? 'sel' : ''}`} onClick={() => set('amount', a)}><div className="eoiopt-t">{a}</div></div>
            ))}
          </div>
          <div className="fg"><label className="fl">Funding Source</label>
            {[['Cash / Existing Funds', 'Ready to deploy'], ['SMSF', 'Super fund'], ['Trust / Company', 'Via entity'], ['Finance Required', 'Need to arrange']].map(([v, s]) => (
              <div key={v} className={`eoiopt ${f.fund === v ? 'sel' : ''}`} onClick={() => set('fund', v)}>
                <div className="eoiopt-t">{v}</div><div className="eoiopt-s">{s}</div>
              </div>
            ))}
          </div>
          <div className="matns">
            <button className="btn btn-o" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setStep(3)}>Continue →</button>
          </div>
        </>}
        {step === 3 && <>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', marginBottom: '16px' }}>
            {[['Name', `${f.fn} ${f.ln}`], ['Email', f.email], ['Amount', f.amount], ['Funding', f.fund], ['Listing', listing.name || listing.title]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: 'rgba(245,242,236,0.32)' }}>{l}</span>
                <span style={{ color: 'var(--paper)' }}>{v || '—'}</span>
              </div>
            ))}
          </div>
          <p>By submitting I consent to Prop Dev DNA contacting me.</p>
          <div className="matns">
            <button className="btn btn-o" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={submit}>Submit →</button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── AUTH MODAL ──────────────────────────────────────────────────
function AuthModal({ onClose, onLogin }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '', fname: '', lname: '', role: 'investor' });
  const [error, setError] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setError('');
    try {
      let res;
      if (mode === 'login') {
        res = await API.post('/api/auth/login', { email: f.email, password: f.password });
      } else {
        res = await API.post('/api/auth/register', { email: f.email, password: f.password, fname: f.fname, lname: f.lname, role: f.role });
      }
      if (res.error) { setError(res.error); return; }
      onLogin(res.user || res);
      onClose();
    } catch (e) { setError('Something went wrong. Please try again.'); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="/logo.png" alt="Prop Dev DNA" style={{ height: 100, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="atabs">
          {[['login', 'Sign In'], ['register', 'Create Account']].map(([m, l]) => (
            <button key={m} className={`atab ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>{l}</button>
          ))}
        </div>
        {mode === 'register' && <>
          <div className="fg"><label className="fl">I am a…</label>
            {[['investor', '💼 Investor', 'Browse & invest'], ['developer', '🏗 Developer', 'List opportunities']].map(([v, t, s]) => (
              <div key={v} className={`eoiopt ${f.role === v ? 'sel' : ''}`} onClick={() => set('role', v)}>
                <div className="eoiopt-t">{t}</div><div className="eoiopt-s">{s}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="fg"><label className="fl">First Name</label><input className="fi" value={f.fname} onChange={e => set('fname', e.target.value)} /></div>
            <div className="fg"><label className="fl">Last Name</label><input className="fi" value={f.lname} onChange={e => set('lname', e.target.value)} /></div>
          </div>
        </>}
        <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={f.email} onChange={e => set('email', e.target.value)} /></div>
        <div className="fg"><label className="fl">Password</label><input className="fi" type="password" value={f.password} onChange={e => set('password', e.target.value)} /></div>
        {error && <div style={{ color: '#e74c3c', fontSize: 11, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-g" style={{ width: '100%', marginTop: 6 }} onClick={submit}>
          {mode === 'login' ? 'Sign In →' : 'Create Account →'}
        </button>
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: '9px', color: 'rgba(245,242,236,0.18)', lineHeight: 1.7 }}>
          Wholesale investors only · s.761G Corporations Act 2001 · Not financial advice
        </p>
      </div>
    </div>
  );
}

// ─── LISTING DETAIL ──────────────────────────────────────────────
function Detail({ l, onBack, onInvest }) {
  const bgs = { NSW: "linear-gradient(160deg,#2A3A2E,#1a2a1e)", VIC: "linear-gradient(160deg,#1e2a3a,#0d1a2e)", QLD: "linear-gradient(160deg,#3a2a1a,#2a1a0d)" };
  return (
    <div>
      <div className="dh" style={{ background: bgs[l.state] || bgs.NSW }}>
        <button className="dback" onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>{l.type} · {l.stage || l.status} · {l.structure}</div>
          <div className="dh1">{l.name || l.title}</div>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.42)' }}>📍 {l.suburb}, {l.state} · {l.units} units · {l.developer || l.developerName}</p>
        </div>
      </div>
      <div className="dbody">
        <div>
          <div className="dmets">
            {[['IRR', l.irr || '—'], ['Term', l.term || '—'], ['Equity', l.equity || '—'], ['LVR', l.ltv || '—']].map(([lb, v]) => (
              <div className="dmet" key={lb}><div className="dmetv">{v}</div><div className="dmetl">{lb}</div></div>
            ))}
          </div>
          <div className="dsec">
            <h2>Project Overview</h2>
            <p>{l.desc || l.description}</p>
          </div>
          {l.highlights && l.highlights.length > 0 && (
            <div className="dsec" style={{ marginTop: 28 }}>
              <h2>Investment Highlights</h2>
              <ul className="hlist">{l.highlights.map(h => <li key={h}>{h}</li>)}</ul>
            </div>
          )}
          <div style={{ marginTop: 24, padding: '16px', background: 'rgba(0,0,0,0.03)', fontSize: '11px', color: '#666', lineHeight: 1.7 }}>
            <strong style={{ color: '#333' }}>Important:</strong> Wholesale investors only · s.761G Corporations Act 2001 · Not financial advice · Seek independent advice before investing.
          </div>
        </div>
        <div className="sbar">
          <div className="sc">
            <h3>Register Interest</h3>
            <p>Receive the full IM and access the due diligence data room.</p>
            {[['Min. Investment', `$${((l.minInvest || 50000) / 1000).toFixed(0)},000`], ['Total Raise', l.raise ? `$${(l.raise / 1e6).toFixed(1)}M` : '—'], ['Structure', l.structure || '—'], ['Distributions', 'Monthly']].map(([lb, v]) => (
              <div className="si" key={lb}><span className="sil">{lb}</span><span className="siv">{v}</span></div>
            ))}
            {l.raise && <PBar raised={l.raised || 0} target={l.raise} />}
            <button className="btn btn-g" style={{ width: '100%', marginTop: 20 }} onClick={onInvest}>Express Interest →</button>
            <div className="sdis">Wholesale investors only · Capital at risk · s.761G Corporations Act 2001</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN PORTAL ────────────────────────────────────────────────
function AdminPortal({ toast }) {
  const [tab, setTab] = useState('certs');
  const [certs, setCerts] = useState([]);
  const [subs, setSubs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rejectNote, setRejectNote] = useState({ id: null, text: '' });

  useEffect(() => { load(); }, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'certs') { const r = await API.get('/api/admin/wholesale-certs'); setCerts(r.certs || []); }
      else if (tab === 'subs') { const r = await API.get('/api/admin/subscriptions'); setSubs(r.subscriptions || []); }
      else if (tab === 'reviews') { const r = await API.get('/api/admin/im-reviews'); setReviews(r.reviews || []); }
      else if (tab === 'leads') { const r = await API.get('/api/interests'); setLeads(Array.isArray(r) ? r : []); }
      else if (tab === 'users') { const r = await API.get('/api/admin/users'); setUsers(r.users || []); }
    } catch(e) {}
    setLoading(false);
  };

  const approveCert = async id => { await API.post(`/api/admin/wholesale-certs/${id}/approve`, {}); toast('✅ Certificate approved'); load(); };
  const rejectCert  = async (id, notes) => { await API.post(`/api/admin/wholesale-certs/${id}/reject`, { notes }); toast('Certificate rejected'); setRejectNote({ id: null, text: '' }); load(); };
  const approveSub  = async id => { await API.post(`/api/admin/subscriptions/${id}/approve`, {}); toast('✅ Subscription activated'); load(); };
  const rejectSub   = async id => { await API.post(`/api/admin/subscriptions/${id}/reject`, {}); toast('Subscription rejected'); load(); };
  const approveIM   = async id => { await API.post(`/api/admin/im-reviews/${id}/approve`, { notes: 'Approved' }); toast('✅ IM approved — listing now live'); load(); };

  const SBadge = ({ s }) => {
    const m = { pending: ['rgba(201,168,76,0.12)', '#c9a84c'], verified: ['rgba(39,174,96,0.12)', '#27ae60'], approved: ['rgba(39,174,96,0.12)', '#27ae60'], active: ['rgba(39,174,96,0.12)', '#27ae60'], rejected: ['rgba(231,76,60,0.12)', '#e74c3c'], submitted: ['rgba(52,152,219,0.12)', '#3498db'], amendments_requested: ['rgba(231,76,60,0.12)', '#e74c3c'], cancelled: ['rgba(128,128,128,0.12)', '#888'] };
    const [bg, color] = m[s] || ['rgba(128,128,128,0.12)', '#888'];
    return <span style={{ background: bg, color, fontSize: 10, padding: '3px 9px', fontWeight: 500 }}>{s?.replace(/_/g, ' ')}</span>;
  };

  const TABS = [['certs', '📄 Wholesale Certs'], ['subs', '💳 Subscriptions'], ['reviews', '📋 IM Reviews'], ['leads', '📊 Leads'], ['users', '👥 Users']];

  return (
    <sec style={{ paddingTop: 80 }}>
      <div className="slbl">Admin</div>
      <div className="stitle" style={{ marginBottom: 8 }}>Operations Portal</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 28 }}>Manage wholesale certifications, developer subscriptions, and IM submissions.</p>

      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(0,0,0,0.08)', overflowX: 'auto' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Sans',sans-serif", color: tab === key ? 'var(--ink)' : 'var(--muted)', borderBottom: tab === key ? '2px solid var(--gold)' : '2px solid transparent', fontWeight: tab === key ? 500 : 400, whiteSpace: 'nowrap', marginBottom: -1 }}>{label}</button>
        ))}
        <button onClick={load} style={{ background: 'none', border: 'none', marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', padding: '10px 12px' }}>↻ Refresh</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}

      {!loading && tab === 'certs' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{certs.filter(c => c.status === 'pending').length} pending review · {certs.length} total</div>
          {certs.length === 0 && <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px solid rgba(0,0,0,0.07)', color: 'var(--muted)', fontSize: 13 }}>No certificates submitted yet.</div>}
          {certs.map(c => (
            <div key={c.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 20, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>{c.userName}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{c.userEmail} · Submitted {new Date(c.submittedAt).toLocaleDateString('en-AU')}</div>
                  <div style={{ fontSize: 11, color: '#444', marginBottom: 3 }}><strong>Accountant:</strong> {c.acctName} — {c.acctFirm} ({c.acctMembership} {c.acctMembershipNumber})</div>
                  <div style={{ fontSize: 11, color: '#444' }}><strong>Basis:</strong> {c.certBasis === 'net_assets' ? 'Net Assets ≥ $2.5M' : 'Gross Income ≥ $250k p.a.'}{c.approxNetAssets ? ` · Est. ${c.approxNetAssets}` : ''}</div>
                  {c.adminNotes && <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 6 }}>Notes: {c.adminNotes}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <SBadge s={c.status} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {c.filePath && <a href={`/api/admin/wholesale-certs/${c.id}/download`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.3)', padding: '5px 10px', textDecoration: 'none' }}>📄 Download</a>}
                    {c.status === 'pending' && <><button className="btn btn-g btn-sm" onClick={() => approveCert(c.id)}>✅ Approve</button><button className="btn btn-d btn-sm" onClick={() => setRejectNote({ id: c.id, text: '' })}>Reject</button></>}
                  </div>
                </div>
              </div>
              {rejectNote.id === c.id && (
                <div style={{ marginTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
                  <label style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Rejection reason (emailed to investor)</label>
                  <textarea value={rejectNote.text} onChange={e => setRejectNote(p => ({ ...p, text: e.target.value }))} style={{ width: '100%', minHeight: 72, fontSize: 12, padding: 10, border: '1px solid rgba(0,0,0,0.1)', fontFamily: "'DM Sans',sans-serif", resize: 'vertical' }} placeholder="e.g. Certificate not signed by a CPA/CA/IPA member accountant..." />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-d btn-sm" onClick={() => rejectCert(c.id, rejectNote.text)}>Confirm Rejection</button>
                    <button className="btn btn-o btn-sm" style={{ color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.15)' }} onClick={() => setRejectNote({ id: null, text: '' })}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'subs' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{subs.filter(s => s.status === 'pending').length} pending · {subs.filter(s => s.status === 'active').length} active</div>
          {subs.length === 0 && <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px solid rgba(0,0,0,0.07)', color: 'var(--muted)', fontSize: 13 }}>No subscription requests yet.</div>}
          {subs.map(s => (
            <div key={s.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 20, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>{s.userName}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.userEmail} · {s.plan} · Requested {new Date(s.requestedAt).toLocaleDateString('en-AU')}</div>
                  {s.paymentRef && <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Payment ref: <strong>{s.paymentRef}</strong></div>}
                  {s.activatedAt && <div style={{ fontSize: 11, color: '#27ae60', marginTop: 2 }}>Activated {new Date(s.activatedAt).toLocaleDateString('en-AU')}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <SBadge s={s.status} />
                  {s.status === 'pending' && <><button className="btn btn-g btn-sm" onClick={() => approveSub(s.id)}>✅ Activate</button><button className="btn btn-d btn-sm" onClick={() => rejectSub(s.id)}>Reject</button></>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'reviews' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{reviews.filter(r => r.status === 'submitted').length} awaiting review</div>
          {reviews.length === 0 && <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px solid rgba(0,0,0,0.07)', color: 'var(--muted)', fontSize: 13 }}>No IM submissions yet.</div>}
          {reviews.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 20, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>{r.listingName}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.devName} · {r.devEmail} · Round {r.round} · Submitted {new Date(r.submittedAt).toLocaleDateString('en-AU')}</div>
                  {r.devResponse && <div style={{ fontSize: 11, color: '#444', marginTop: 6, fontStyle: 'italic' }}>Dev notes: "{r.devResponse}"</div>}
                  {r.amendments?.length > 0 && <div style={{ marginTop: 8 }}>{r.amendments.map((a, i) => <div key={i} style={{ fontSize: 11, color: '#e74c3c' }}>• {a}</div>)}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <SBadge s={r.status} />
                  {r.status === 'submitted' && <button className="btn btn-g btn-sm" onClick={() => approveIM(r.id)}>✅ Approve & Go Live</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'leads' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{leads.length} total leads</div>
          {leads.length === 0 && <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px solid rgba(0,0,0,0.07)', color: 'var(--muted)', fontSize: 13 }}>No leads yet.</div>}
          {leads.map(l => (
            <div key={l.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 18, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 600 }}>{l.fname} {l.lname}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.email}{l.phone ? ` · ${l.phone}` : ''}</div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Interest in: <strong>{l.listingName}</strong> · Amount: {l.amount || 'Not specified'}</div>
                {l.comments && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>"{l.comments}"</div>}
                {l.needsBroker && <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 4 }}>⚡ Requested broker introduction</div>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
                <div>{l.refCode}</div>
                <div style={{ marginTop: 4 }}>{new Date(l.createdAt).toLocaleDateString('en-AU')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'users' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{users.length} registered users</div>
          {users.length === 0 && <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px solid rgba(0,0,0,0.07)', color: 'var(--muted)', fontSize: 13 }}>No users yet.</div>}
          {users.map(u => (
            <div key={u.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 18, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 600 }}>{u.fname} {u.lname}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email} · Joined {new Date(u.joined || Date.now()).toLocaleDateString('en-AU')}</div>
                {u.wholesaleStatus && u.wholesaleStatus !== 'none' && <div style={{ fontSize: 11, color: '#444', marginTop: 3 }}>Wholesale: {u.wholesaleStatus}{u.wholesaleExpiresAt ? ` · Expires ${new Date(u.wholesaleExpiresAt).toLocaleDateString('en-AU')}` : ''}</div>}
                {u.referredBy && <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 3 }}>Referred by: {u.referredByName} ({u.referredBy})</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '3px 9px', background: u.role === 'admin' ? 'rgba(201,168,76,0.15)' : u.role === 'developer' ? 'rgba(52,152,219,0.12)' : 'rgba(39,174,96,0.08)', color: u.role === 'admin' ? '#c9a84c' : u.role === 'developer' ? '#3498db' : '#27ae60', fontWeight: 500 }}>{u.role}</span>
                {u.wholesaleStatus === 'verified' && <span style={{ fontSize: 10, padding: '3px 9px', background: 'rgba(39,174,96,0.1)', color: '#27ae60' }}>✓ Wholesale</span>}
                {u.wholesaleStatus === 'pending' && <span style={{ fontSize: 10, padding: '3px 9px', background: 'rgba(201,168,76,0.1)', color: '#c9a84c' }}>⏳ Cert pending</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </sec>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('home');
  const [filter, setFilter] = useState('All');
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [sel, setSel] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showComp, setShowComp] = useState(false);
  const [showEOI, setShowEOI] = useState(false);
  const [toast, setToast] = useState(null);
  const [pDone, setPDone] = useState(false);
  const [pf, setPf] = useState({ company: '', name: '', email: '', phone: '', type: '', raise: '' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showT = msg => { setToast(msg); setTimeout(() => setToast(null), 3500); };
  const go = pg => { setPage(pg); window.scrollTo && window.scrollTo(0, 0); };
  const invest = () => { if (!user) { setShowAuth(true); return; } setShowComp(true); };
  const setP = (k, v) => setPf(p => ({ ...p, [k]: v }));

  useEffect(() => {
    API.get('/api/auth/me').then(res => {
      if (res && !res.error) setUser(res);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (page === 'listings' || page === 'home') {
      setLoadingListings(true);
      API.get('/api/listings').then(res => {
        if (Array.isArray(res)) setListings(res.map(normaliseListing));
        setLoadingListings(false);
      }).catch(() => setLoadingListings(false));
    }
  }, [page]);

  const filtered = listings.filter(l => {
    if (filter === 'All') return true;
    if (['NSW', 'VIC', 'QLD'].includes(filter)) return l.state === filter;
    if (filter === 'High Yield (>20%)') return parseInt(l.irr) > 20;
    return l.stage === filter || l.status === filter;
  });

  const logout = async () => {
    await API.post('/api/auth/logout', {});
    setUser(null);
    go('home');
    showT('Signed out.');
  };

  return (
    <>
      <style>{css}</style>
      <div className="notice">
        <strong>Wholesale Investors Only</strong> · s.761G Corporations Act 2001 (Cth) · Not financial advice · Capital at risk
      </div>

      <nav>
        <button className="logo" onClick={() => go('home')}>
          <img src="/logo.png" alt="Prop Dev DNA" style={{ height: 210, width: 'auto', objectFit: 'contain', mixBlendMode: 'lighten', background: 'transparent', border: 'none', outline: 'none' }} onError={e => e.target.style.display = 'none'} />
          <span className="logo-slogan">Empower Your Property to Empower Your Life</span>
        </button>
        <div className="nav-links">
          <button className="nl" onClick={() => go('listings')}>Opportunities</button>
          <button className="nl" onClick={() => go('portal')}>Developers</button>
          <button className="nl" onClick={() => go('tiers')}>Investor Tiers</button>
          <button className="nl" onClick={() => go('about')}>About</button>
          <button className="nl" onClick={() => go('pricing')}>Pricing</button>
          {user
            ? <>
              {user.role === 'admin' && <button className="nl" style={{ color: '#e74c3c' }} onClick={() => go('admin')}>⚙ Admin</button>}
              <button className="nl" style={{ color: 'var(--gold)' }} onClick={() => go('dashboard')}>My Account</button>
              <button className="nl" onClick={logout}>Sign Out</button>
            </>
            : <button className="nl cta" onClick={() => setShowAuth(true)}>Sign In</button>
          }
        </div>
        <button className={`hamburger${mobileMenuOpen ? ' open' : ''}`} onClick={() => setMobileMenuOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
        {mobileMenuOpen && (
          <div className="mobile-menu open">
            {[['listings','Opportunities'],['portal','Developers'],['tiers','Investor Tiers'],['about','About'],['pricing','Pricing']].map(([pg, label]) => (
              <button key={pg} className="nl" onClick={() => { go(pg); setMobileMenuOpen(false); }}>{label}</button>
            ))}
            {user ? <>
              {user.role === 'admin' && <button className="nl" style={{ color: '#e74c3c' }} onClick={() => { go('admin'); setMobileMenuOpen(false); }}>⚙ Admin</button>}
              <button className="nl" style={{ color: 'var(--gold)' }} onClick={() => { go('dashboard'); setMobileMenuOpen(false); }}>My Account</button>
              <button className="nl" onClick={() => { logout(); setMobileMenuOpen(false); }}>Sign Out</button>
            </> : <button className="nl cta" onClick={() => { setShowAuth(true); setMobileMenuOpen(false); }}>Sign In</button>}
          </div>
        )}
      </nav>

      {/* ── HOME ── */}
      {page === 'home' && <>
        <div className="hero">
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&q=80&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center 30%', opacity: 0.18 }} />
          <div className="hgrid" /><div className="hglow" />
          <div className="badge-hero"><span className="bdot" />{listings.length || '6'} Live Opportunities</div>
          <h1 className="h1">Where Capital<br />Meets <em>Development</em></h1>
          <p className="hsub">Australia's professional platform connecting wholesale investors with curated property development opportunities. FEASO-grade due diligence. Real projects. Real returns.</p>
          <div className="hbtns">
            <button className="btn btn-g" onClick={() => go('listings')}>Browse Opportunities →</button>
            <button className="btn btn-o" onClick={() => go('portal')}>List Your Project</button>
          </div>
          <div className="hstats">
            {[['$140M+', 'Deals in Network'], [String(listings.length || 6), 'Live Listings'], ['22%', 'Avg. Target IRR'], ['4 Tiers', 'Investor Verification']].map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}><div className="sn">{n}</div><div className="sl">{l}</div></div>
            ))}
          </div>
        </div>

        <sec style={{ background: '#0a0a0a', padding: '48px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
            <div>
              <div className="slbl">Investor Verification</div>
              <div className="stitle" style={{ color: '#fff', marginBottom: 0 }}>Four Tiers of Trust</div>
            </div>
            <button className="btn btn-o btn-sm" onClick={() => go('tiers')}>Learn More →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'rgba(201,168,76,0.07)' }}>
            {Object.entries(TIERS).map(([key, t], i) => (
              <div key={key} style={{ background: '#0f0f0f', padding: '28px 20px', borderTop: `2px solid ${t.color}`, position: 'relative' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, fontSize: 16 }}>
                  {['🔵','🟡','🟢','⭐'][i]}
                </div>
                <div style={{ fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: t.color, marginBottom: 6 }}>Tier {i+1}</div>
                <div style={{ fontSize: 15, fontFamily: "'Cormorant Garamond',serif", color: '#fff', fontWeight: 600, marginBottom: 8 }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(245,242,236,0.38)', lineHeight: 1.7 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </sec>

        <sec className="how-sec">
          <div className="slbl">The Platform</div>
          <div className="stitle" style={{ color: '#fff' }}>Built for Serious Capital</div>
          <p className="ssub" style={{ color: 'rgba(245,242,236,0.38)' }}>From feasibility to funded — three steps.</p>
          <div className="steps">
            {[
              { n: '01', svg: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>, t: 'Discover', d: 'Browse FEASO-reviewed development opportunities filtered by state, stage, and return profile.' },
              { n: '02', svg: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/></svg>, t: 'Analyse', d: 'Access full Information Memoranda, FEASO reports, and developer profiles in the secure data room.' },
              { n: '03', svg: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, t: 'Invest', d: 'Register interest, complete wholesale verification, and confirm your capital allocation.' },
            ].map(s => (
              <div className="step" key={s.n}>
                <div className="stn">{s.n}</div>
                <div style={{ marginBottom: 16 }}>{s.svg}</div>
                <h3>{s.t}</h3><p>{s.d}</p>
              </div>
            ))}
          </div>
        </sec>

        <sec>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div><div className="slbl">Live Now</div><div className="stitle" style={{ marginBottom: 0 }}>Current Opportunities</div></div>
            <button className="btn btn-d btn-sm" onClick={() => go('listings')}>View All →</button>
          </div>
          {loadingListings ? <p style={{ color: 'var(--muted)' }}>Loading…</p> :
            <div className="grid">
              {listings.slice(0, 3).map(l => <Card key={l.id} l={l} onClick={() => { setSel(l); go('detail'); }} />)}
            </div>
          }
        </sec>

        <sec style={{ background: 'var(--sage)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=80&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.12 }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="slbl" style={{ color: 'rgba(201,168,76,0.55)' }}>For Developers</div>
            <div className="stitle" style={{ color: '#fff', maxWidth: 520, margin: '0 auto 14px' }}>Ready to Raise Capital for Your Next Project?</div>
            <p className="ssub" style={{ color: 'rgba(255,255,255,0.38)', margin: '0 auto 32px' }}>FEASO builder + IM generator + verified wholesale investor network.</p>
            <button className="btn btn-g" onClick={() => go('portal')}>Submit Your Project →</button>
          </div>
        </sec>
      </>}

      {/* ── LISTINGS ── */}
      {page === 'listings' && (
        <sec style={{ paddingTop: 80 }}>
          <div className="slbl">Investment Opportunities</div>
          <div className="stitle">Current Listings</div>
          <p className="ssub" style={{ marginBottom: 28 }}>Wholesale investors only. Quality-reviewed before listing.</p>
          <div className="filters">
            {FILTERS.map(f => <button key={f} className={`fb ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
          {loadingListings ? <p style={{ color: 'var(--muted)', padding: '48px 0', textAlign: 'center' }}>Loading listings…</p>
            : filtered.length === 0
              ? <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
                {user ? 'No listings match this filter.' : 'Sign in to view available listings.'}
              </div>
              : <div className="grid">{filtered.map(l => <Card key={l.id} l={l} onClick={() => { setSel(l); go('detail'); }} />)}</div>
          }
        </sec>
      )}

      {/* ── DETAIL ── */}
      {page === 'detail' && sel && <Detail l={sel} onBack={() => go('listings')} onInvest={invest} />}

      {/* ── INVESTOR TIERS ── */}
      {page === 'tiers' && (
        <>
          <sec style={{ paddingTop: 100, background: 'var(--ink)' }}>
            <div className="slbl">Verification System</div>
            <div className="stitle" style={{ color: '#fff' }}>Four Tiers of Investor Trust</div>
            <p className="ssub" style={{ color: 'rgba(245,242,236,0.4)', marginBottom: 0 }}>Prop Dev DNA's tiered verification system protects developers and gives investors access proportional to their verified status.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'rgba(201,168,76,0.08)', marginTop: 48 }}>
              {Object.entries(TIERS).map(([key, t], i) => (
                <div key={key} style={{ background: i === 3 ? '#0f0f0f' : 'var(--ink)', padding: '36px 24px', borderTop: `3px solid ${t.color}` }}>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>{t.badge}</div>
                  <div style={{ fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: t.color, marginBottom: 8 }}>Tier {i + 1}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: '#fff', fontWeight: 600, marginBottom: 12 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(245,242,236,0.35)', lineHeight: 1.7 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </sec>
          <sec style={{ background: '#0a0a0a' }}>
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
              <div className="slbl" style={{ textAlign: 'center' }}>How to Upgrade</div>
              <div className="stitle" style={{ color: '#fff', textAlign: 'center' }}>Your Verification Journey</div>
              {[
                { step: '01', title: 'Create Your Account', sub: 'Register with email and select Wholesale Investor role.' },
                { step: '02', title: 'Upload Accountant Certificate', sub: 'Submit your s.761G certificate. Approved within 24 hours.' },
                { step: '03', title: 'Upload Proof of Funds', sub: 'Bank statement, SMSF balance, or solicitor trust letter.' },
                { step: '04', title: 'Request PDD Pre-Qualification', sub: 'Anthony Lawson reviews your position as a licensed broker.' },
              ].map(s => (
                <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, color: 'rgba(201,168,76,0.15)', lineHeight: 1, flexShrink: 0, width: 56 }}>{s.step}</div>
                  <div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: '#fff', marginBottom: 6 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(245,242,236,0.4)', lineHeight: 1.7 }}>{s.sub}</div>
                  </div>
                </div>
              ))}
              <button className="btn btn-g" style={{ marginTop: 32 }} onClick={() => user ? go('dashboard') : setShowAuth(true)}>
                {user ? 'Go to My Dashboard →' : 'Create Account & Start →'}
              </button>
            </div>
          </sec>
        </>
      )}

      {/* ── DASHBOARD ── */}
      {page === 'dashboard' && user && (
        <sec style={{ paddingTop: 80 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="slbl">Investor Dashboard</div>
              <div className="stitle" style={{ marginBottom: 4 }}>Welcome back, {user.fname || user.email}</div>
              <TierBadge tier={user.wholesaleStatus === 'verified' ? 'verified' : 'registered'} size="lg" />
            </div>
            <button className="btn btn-d btn-sm" onClick={() => go('listings')}>Browse Opportunities →</button>
          </div>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 24 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Account Details</div>
            <div className="profile-grid">
              {[['Email', user.email], ['Role', user.role], ['Status', user.wholesaleStatus || 'registered'], ['Member Since', new Date(user.createdAt || Date.now()).toLocaleDateString('en-AU')]].map(([l, v]) => (
                <div className="profile-field" key={l}>
                  <div className="profile-label">{l}</div>
                  <div className="profile-value">{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: '16px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', fontSize: 12, color: '#444', lineHeight: 1.7 }}>
              💡 To unlock full IM access, submit your <strong>s.761G wholesale investor certificate</strong> via the profile page in the full platform.
            </div>
          </div>
        </sec>
      )}

      {/* ── ADMIN PORTAL ── */}
      {page === 'admin' && user?.role === 'admin' && <AdminPortal toast={showT} />}
      {page === 'admin' && user?.role !== 'admin' && (
        <sec style={{ paddingTop: 80, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div className="stitle">Access Denied</div>
          <p className="ssub" style={{ margin: '0 auto' }}>Admin access required.</p>
        </sec>
      )}

      {/* ── DEVELOPER PORTAL ── */}
      {page === 'portal' && (
        <sec style={{ paddingTop: 80 }}>
          {pDone ? (
            <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>🧬</div>
              <div className="slbl">Application Received</div>
              <div className="stitle">We'll Be in Touch</div>
              <p className="ssub" style={{ margin: '0 auto' }}>Our team will review your project and contact you within 2 business days.</p>
            </div>
          ) : (
            <div className="portal">
              <div>
                <div className="slbl">For Developers</div>
                <div className="stitle">List Your Project.<br />Connect with Capital.</div>
                <p className="ssub">Professional FEASO builder, IM generator, and verified wholesale investor access.</p>
                <ul className="pfeats">
                  {[{ i: '🎯', t: 'Qualified Investors', d: 'Pre-screened wholesale investors with verified proof of funds.' },
                  { i: '📋', t: 'FEASO & IM Tools', d: 'Live feasibility calculator and 16-page IM with ASIC disclaimers.' },
                  { i: '🔒', t: 'Secure Data Room', d: 'Share project documents privately with verified investors only.' },
                  { i: '⚡', t: '48-Hour Live', d: 'Pass quality review and go live within 48 hours.' },
                  ].map(f => (
                    <li className="pf2" key={f.t}>
                      <div className="pfi">{f.i}</div>
                      <div><h4>{f.t}</h4><p>{f.d}</p></div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pform">
                <h3>Submit Your Project</h3>
                <p>All submissions reviewed within 48 hours.</p>
                {[['company', 'Company / Entity'], ['name', 'Your Name'], ['email', 'Email'], ['phone', 'Phone']].map(([k, l]) => (
                  <div className="fg" key={k}><label className="fl">{l}</label><input className="fi" value={pf[k]} onChange={e => setP(k, e.target.value)} /></div>
                ))}
                <div className="fg"><label className="fl">Development Type</label>
                  <select className="fi" value={pf.type} onChange={e => setP('type', e.target.value)}>
                    <option value="">Select</option>
                    {['Residential Apartments', 'Townhouses', 'Land Subdivision', 'Mixed-Use', 'Adaptive Reuse', 'Commercial'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Capital Raise Target</label>
                  <select className="fi" value={pf.raise} onChange={e => setP('raise', e.target.value)}>
                    <option value="">Select</option>
                    {['Under $1M', '$1M–$3M', '$3M–$5M', '$5M–$10M', '$10M+'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <button className="btn btn-g" style={{ width: '100%', marginTop: 6 }}
                  onClick={() => pf.company && pf.name && pf.email ? setPDone(true) : showT('Fill in required fields')}>
                  Submit Project →
                </button>
                <div className="snote">💳 Developer subscription ($299/month + GST) activated after project review.</div>
              </div>
            </div>
          )}
        </sec>
      )}

      {/* ── ABOUT ── */}
      {page === 'about' && (
        <sec style={{ paddingTop: 80 }}>
          <div className="about-grid">
            <div>
              <div className="slbl">About the Platform</div>
              <div className="stitle">Built by a Broker.<br />For the Deal Table.</div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.75, marginBottom: 20 }}>Prop Dev DNA was founded by Anthony Lawson — mortgage broker, financial adviser, and property development finance specialist based in Sydney.</p>
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.75, marginBottom: 24 }}>Built to solve a real problem: connecting serious developers with qualified capital, efficiently and professionally.</p>
              {[{ i: '🏦', t: 'Financial DNA Group', s: 'Director — Mortgage Broking & Financial Advice' },
              { i: '🏗️', t: 'Prop Dev DNA', s: 'Founder — Wholesale Property Investment Platform' },
              { i: '🧠', t: 'Quality Mind DNA', s: 'Psychosocial Support for Healthcare' },
              { i: '📍', t: 'Sydney, NSW', s: 'Serving clients nationally' },
              ].map(c => (
                <div className="acred" key={c.t}>
                  <span className="acred-i">{c.i}</span>
                  <div className="acred-t"><strong>{c.t}</strong>{c.s}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="aphoto" style={{ position: 'relative', overflow: 'hidden', borderRadius: 0 }}>
                <img
                  src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80&fit=crop&crop=face"
                  alt="Anthony Lawson"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                  onError={e => { e.target.style.display='none'; }}
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(42,58,46,0.9) 0%, transparent 60%)', padding: '24px 20px 16px' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: '#fff', fontWeight: 600 }}>Anthony Lawson</div>
                  <div style={{ fontSize: 11, color: 'rgba(201,168,76,0.8)', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 4 }}>Director — Financial DNA Group</div>
                </div>
              </div>
              <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.16)', padding: '18px', marginTop: 14 }}>
                <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>Contact</div>
                <p style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.7 }}>anthony@financialdnagroup.com.au<br />0414 744 516<br />Sydney NSW</p>
              </div>
            </div>
          </div>
        </sec>
      )}

      {/* ── PRICING ── */}
      {page === 'pricing' && (
        <sec style={{ paddingTop: 80, background: 'var(--ink)' }}>
          <div className="slbl">Pricing</div>
          <div className="stitle" style={{ color: 'var(--paper)' }}>Transparent Pricing</div>
          <p className="ssub" style={{ color: 'rgba(245,242,236,0.38)' }}>Developers pay to list. Investors verify free.</p>
          <div className="pgrid">
            {[{ plan: 'Investor', price: 'Free', per: '', f: ['Browse all listings', 'Full IM access (Verified+)', 'Express interest on any deal', 'Proof of funds verification', 'PDD pre-qualification available', 'Complimentary broker referral'], cta: 'Create Free Account' },
            { plan: 'Developer', price: '$299', per: '/month + GST', f: ['Unlimited listings', 'FEASO builder + IM generator', 'Investor tier filtering', 'Proof of funds badge visibility', 'Investor lead tracking', '1.5% success fee on closes'], cta: 'Start 7-Day Trial', feat: true },
            { plan: 'Success Fee', price: '1.5%', per: 'of capital raised', f: ['Only on completed closes', 'Equity, mezz & JV raises', 'Broker referral $500–$1,500', 'Invoiced within 7 days of settlement'], cta: 'Discuss Your Project' },
            ].map(p => (
              <div className={`pc ${p.feat ? 'feat' : ''}`} key={p.plan}>
                <div className="pplan">{p.plan}</div>
                <div className="pprice">{p.price}</div>
                <div className="pper">{p.per}</div>
                <ul className="pfl">{p.f.map(f => <li key={f}>{f}</li>)}</ul>
                <button className={`btn ${p.feat ? 'btn-g' : 'btn-o'}`} style={{ width: '100%' }}
                  onClick={() => p.plan === 'Investor' ? setShowAuth(true) : go('portal')}>
                  {p.cta} →
                </button>
              </div>
            ))}
          </div>
        </sec>
      )}

      {/* ── FOOTER ── */}
      <footer>
        <div className="ftop">
          <div>
            <div className="flogo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo.png" alt="Prop Dev DNA" style={{ height: 44, width: 'auto', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
              <span>Prop Dev DNA</span>
            </div>
            <p className="ftag">Australia's professional wholesale property investment platform.</p>
          </div>
          <div>
            <div className="fch4">Platform</div>
            {[['listings', 'Opportunities'], ['portal', 'For Developers'], ['tiers', 'Investor Tiers'], ['pricing', 'Pricing']].map(([pg, l]) => <button key={l} className="fl2" onClick={() => go(pg)}>{l}</button>)}
          </div>
          <div>
            <div className="fch4">Company</div>
            {[['about', 'About'], ['about', 'Contact']].map(([pg, l]) => <button key={l} className="fl2" onClick={() => go(pg)}>{l}</button>)}
          </div>
          <div>
            <div className="fch4">Contact</div>
            <p className="fl2">info@propdevdna.com.au</p>
            <p className="fl2">0414 744 516</p>
            <p className="fl2">Sydney, NSW</p>
          </div>
        </div>
        <div className="fbot">
          <p className="flegal">Restricted to wholesale investors under s.761G Corporations Act 2001 (Cth). No AFSL held. Not financial product advice. Capital at risk. © 2026 Prop Dev DNA Pty Ltd.</p>
          <p className="fcopy">© 2026 Prop Dev DNA</p>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onLogin={u => { setUser(u); showT(`Welcome, ${u.fname || u.email} 👋`); go('dashboard'); }} />}
      {showComp && <CompModal listing={sel} onAccept={() => { setShowComp(false); setShowEOI(true); }} onClose={() => setShowComp(false)} />}
      {showEOI && sel && <EOIModal listing={sel} onClose={() => setShowEOI(false)} toast={showT} user={user} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
