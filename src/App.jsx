import { useState, useEffect } from "react";

// ─── API LAYER ────────────────────────────────────────────────────
const API = {
  get: (url) => fetch(url, { credentials: 'include' }).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) }).then(r => r.json()),
  put: (url, data) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) }).then(r => r.json()),
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

// ─── CSS ─────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--gold:#C9A84C;--ink:#0D0D0D;--paper:#F5F2EC;--sage:#2A3A2E;--muted:#6B6B5A}
  body{font-family:'DM Sans',sans-serif;background:var(--paper);color:var(--ink);overflow-x:hidden;-webkit-font-smoothing:antialiased}
  .notice{background:rgba(201,168,76,0.08);border-bottom:1px solid rgba(201,168,76,0.2);padding:8px 20px;text-align:center;font-size:11px;color:rgba(13,13,13,0.6)}
  .notice strong{color:var(--gold)}
  nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:center;gap:32px;padding:0 32px;height:48px;background:rgba(13,13,13,0.98);backdrop-filter:blur(16px);border-bottom:1px solid rgba(201,168,76,0.1)}
  .logo{cursor:pointer;background:none;border:none;display:flex;align-items:center;gap:10px;padding:0}
  .logo-text{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
  .logo-name{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:700;color:var(--gold);line-height:1}
  .logo-slogan{font-size:13px;color:rgba(201,168,76,0.75);letter-spacing:1.5px;text-transform:uppercase;font-family:'DM Sans',sans-serif;font-weight:300}
  .nav-links{display:flex;align-items:center;gap:20px}
  .nl{color:rgba(245,242,236,0.55);font-size:12px;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;transition:color 0.2s;padding:0}
  .nl:hover{color:var(--gold)}
  .nl.cta{background:var(--gold);color:var(--ink);font-size:10px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;padding:8px 18px}
  .nl.cta:hover{opacity:0.85}
  .hero{min-height:90vh;background:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 24px;position:relative;overflow:hidden}
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
  .card:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(0,0,0,0.09);border-color:var(--gold)}
  .cimg{height:200px;display:flex;align-items:center;justify-content:center;font-size:48px;position:relative;overflow:hidden;background:var(--ink)}
  .cimg-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.6;transition:opacity 0.3s}
  .card:hover .cimg-photo{opacity:0.8}
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
  .pgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(201,168,76,0.07);margin-top:44px}
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
  /* ── Details/summary custom styling ── */
  details summary{outline:none}
  details summary::-webkit-details-marker{display:none}
  details[open] summary span:last-child{transform:rotate(45deg);display:inline-block}
  details[open]{background:rgba(255,255,255,0.02)}

  /* ── Button refinements ── */
  .btn-o-light{background:transparent;color:var(--ink);border:1px solid rgba(13,13,13,0.2)}.btn-o-light:hover{border-color:var(--gold);color:var(--gold)}

  /* ── Card image hover ── */
  .acc-card:hover .acc-img{opacity:0.55}
  .acc-img{transition:opacity 0.4s}

  @media(max-width:900px){
    .steps,.portal,.pgrid,.about-grid,.ftop,.tiers-grid,.dash-grid{grid-template-columns:1fr}
    .dbody{grid-template-columns:1fr}
    .dmets{grid-template-columns:repeat(2,1fr)}
    .profile-grid{grid-template-columns:1fr}
    sec{padding:48px 20px}
    .dh{padding:64px 20px 28px}
    .dbody{padding:24px 20px}
  }
  @media(max-width:768px){
    /* Sizzle hero stacks on mobile */
    .sizzle-hero{flex-direction:column !important;min-height:auto !important}
    .sizzle-left,.sizzle-right{flex:0 0 100% !important;padding:40px 24px 60px !important}
    .sizzle-divider{display:none !important}
    .sizzle-medallion{display:none !important}
    /* Tiers 2x2 on tablet */
    .tiers-grid{grid-template-columns:repeat(2,1fr) !important}
    /* Accountability cards stack */
    .acc-grid{grid-template-columns:1fr !important}
    /* Footer simplified */
    .ftop{grid-template-columns:1fr 1fr !important}
    nav{gap:16px;padding:0 16px;overflow-x:auto;justify-content:flex-start}
    .nl{font-size:10px;white-space:nowrap}
  }
  @media(max-width:480px){
    nav{gap:12px}
    .ftop{grid-template-columns:1fr !important}
    .sizzle-left,.sizzle-right{padding:32px 20px 56px !important}
  }
`;

// ─── HELPERS ─────────────────────────────────────────────────────
function parseMoney(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function normaliseListing(l) {
  const raise = parseMoney(l.raise);
  const minInvest = parseMoney(l.minInvest);
  const raised = Math.round(raise * (l.fundedPct || 0) / 100);
  const loc = (l.loc || '').replace('📍', '').trim();
  const parts = loc.split(',').map(s => s.trim());
  let suburb = loc, state = '';
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].split(' ');
    state = tail[tail.length - 1];
    const tailRest = tail.slice(0, -1).join(' ');
    suburb = parts.slice(0, -1).join(', ') + (tailRest ? ` ${tailRest}` : '');
  }
  return {
    ...l,
    raise, minInvest, raised, suburb, state,
    term: l.hold || l.term,
    irr: l.irr != null ? `${l.irr}%` : l.irr,
    stage: l.badge || l.status,
    desc: l.overview || l.desc,
    developer: l.developer?.name || l.developer,
  };
}

function PBar({ raised, target }) {
  const pct = Math.min(100, Math.round((raised / target) * 100));
  const fmt = v => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`;
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

function Card({ l, onClick, user }) {
  const closing = l.raised / l.raise > 0.85;
  const cardPhotos = [
    'photo-1545324418-cc1a3fa10c00','photo-1590650153855-d9e808231d41',
    'photo-1486406146926-c627a92ad1ab','photo-1580587771525-78b9dba3b914',
    'photo-1512917774080-9991f1c4c750','photo-1460317442991-0ec209397118',
  ];
  const photoIdx = (l.id||l.name||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)%cardPhotos.length;
  const cardPhoto = l.photo||`https://images.unsplash.com/${cardPhotos[photoIdx]}?w=600&q=80&fit=crop&auto=format`;
  const riskMap = { conservative:['low'], balanced:['low','medium'], growth:['low','medium','high'], aggressive:['low','medium','high','very-high'] };
  const investorProfile = user?.riskProfile || 'balanced';
  const dealRisk = l.riskLevel || 'medium';
  const isSuitable = !user || (riskMap[investorProfile]||['low','medium']).includes(dealRisk);
  return (
    <div className="card" onClick={onClick} style={{ position:'relative' }}>
      {!isSuitable && (
        <div style={{ background:'rgba(201,168,76,0.95)', padding:'5px 12px', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11 }}>⚠️</span>
          <span style={{ fontSize:9, fontWeight:500, color:'#0D0D0D', letterSpacing:'0.5px', textTransform:'uppercase' }}>Outside your risk profile — review carefully</span>
        </div>
      )}
      <div className="cimg" style={{ background:'#0a0a0a' }}>
        <img src={cardPhoto} alt={l.name||l.title} loading="lazy" className="cimg-photo" />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, rgba(13,13,13,0.85) 100%)' }} />
        <div className="cstage">{l.stage||l.status}</div>
        {l.irr && <div style={{ position:'absolute', bottom:10, right:10, background:'rgba(201,168,76,0.9)', color:'#0D0D0D', fontSize:11, fontWeight:600, padding:'4px 10px' }}>{l.irr} IRR</div>}
      </div>
      <div className="cbody">
        <div className="ctype">{l.type} · {l.state}</div>
        <div className="cname">{l.name || l.title}</div>
        <div className="cloc">📍 {l.suburb}, {l.state}</div>
        <div className="cmets">
          <div className="cm"><div className="cmv">{l.irr || '—'}</div><div className="cml">IRR</div></div>
          <div className="cm"><div className="cmv">{l.term || '—'}</div><div className="cml">Term</div></div>
          <div className="cm"><div className="cmv">${((l.minInvest || 50000) / 1000).toFixed(0)}K</div><div className="cml">Min.</div></div>
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
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div className="mlbl" style={{ color: 'var(--gold)' }}>48-Hour Confirmation Window</div>
        <h2 style={{ marginBottom: 12 }}>{listing.name || listing.title}</h2>
        <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', padding: '16px 20px', marginBottom: 16, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>Your expression of interest has been received.</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
            This is <strong>not a binding commitment</strong>. You have <strong>48 hours</strong> to confirm or withdraw.<br/>
            We will send a confirmation email to <strong>{f.email}</strong> with a confirm and withdraw link.<br/>
            If you do not confirm within 48 hours your expression of interest will be automatically withdrawn.
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
          This voluntary cooling-off window is provided as an additional investor protection measure. Wholesale investment products are not legally required to offer a cooling-off period — we do so by choice.
        </div>
        <button className="btn btn-g" onClick={onClose}>Understood — Check My Email</button>
        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          s.761G Corporations Act 2001 · Not financial product advice
        </div>
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
            {[['Cash / Existing Funds', 'Ready to deploy'], ['SMSF', 'Super fund — additional checklist applies'], ['Trust / Company', 'Via entity'], ['Finance Required', 'Need to arrange']].map(([v, s]) => (
              <div key={v} className={`eoiopt ${f.fund === v ? 'sel' : ''}`} onClick={() => set('fund', v)}>
                <div className="eoiopt-t">{v}</div><div className="eoiopt-s">{s}</div>
              </div>
            ))}
          </div>
          {f.fund === 'SMSF' && (
            <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', padding: '14px 16px', marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>⚠️ SMSF Investment — Additional Requirements</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 10 }}>
                SMSF investment in development finance requires specific compliance. Before proceeding please confirm:
              </div>
              {[
                'Your SMSF trust deed permits investment in property development finance and managed investment scheme interests',
                'This investment will be made on commercial arm\'s length terms — not with a related party of the fund',
                'The investment is consistent with your fund\'s investment strategy and the sole purpose test',
                'All SMSF trustees have provided written consent to this investment',
                'You have sought or will seek advice from an SMSF specialist accountant or financial adviser',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11, color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--gold)', flexShrink: 0 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
                By selecting SMSF as your funding source you confirm you have read and understood the above requirements. This platform does not provide SMSF or financial advice — seek independent SMSF specialist advice before investing.
              </div>
            </div>
          )}
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
          <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', padding: '12px 14px', marginBottom: 14, fontSize: 11, color: 'var(--muted)', lineHeight: 1.65 }}>
            ⏳ <strong style={{ color: 'var(--ink)' }}>48-hour cooling-off window applies.</strong> Submitting this form is not a binding commitment. You will receive an email to confirm or withdraw within 48 hours.
          </div>
          <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>By submitting I consent to Prop Dev DNA contacting me regarding this opportunity. Wholesale investors only · s.761G Corporations Act 2001.</p>
          <div className="matns">
            <button className="btn btn-o" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={submit}>Submit Expression of Interest →</button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── AUTH MODAL ──────────────────────────────────────────────────
function AuthModal({ onClose, onLogin, defaultRole }) {
  const [mode, setMode] = useState(defaultRole ? 'register' : 'login');
  const [f, setF] = useState({ email: '', password: '', fname: '', lname: '', role: defaultRole || 'investor', trade: '' });
  const [error, setError] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setError('');
    try {
      let res;
      if (mode === 'login') {
        res = await API.post('/api/auth/login', { email: f.email, password: f.password });
      } else {
        res = await API.post('/api/auth/register', { email: f.email, password: f.password, fname: f.fname, lname: f.lname, role: f.role, trade: f.trade });
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
          <img src="/logo.png" alt="Prop Dev DNA" style={{ height: 72, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="atabs">
          {[['login', 'Sign In'], ['register', 'Create Account']].map(([m, l]) => (
            <button key={m} className={`atab ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>{l}</button>
          ))}
        </div>
        {mode === 'register' && <>
          <div className="fg"><label className="fl">I am a…</label>
            {[['investor', '💼 Investor', 'Browse & invest'], ['developer', '🏗 Developer', 'List opportunities'], ['subcontractor', '🔧 Subcontractor', 'Get assigned & scored on stages']].map(([v, t, s]) => (
              <div key={v} className={`eoiopt ${f.role === v ? 'sel' : ''}`} onClick={() => set('role', v)}>
                <div className="eoiopt-t">{t}</div><div className="eoiopt-s">{s}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="fg"><label className="fl">First Name</label><input className="fi" value={f.fname} onChange={e => set('fname', e.target.value)} /></div>
            <div className="fg"><label className="fl">Last Name</label><input className="fi" value={f.lname} onChange={e => set('lname', e.target.value)} /></div>
          </div>
          {f.role === 'subcontractor' && (
            <div className="fg"><label className="fl">Trade / Specialty</label><input className="fi" placeholder="e.g. Concrete & Structural" value={f.trade} onChange={e => set('trade', e.target.value)} /></div>
          )}
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

// ─── STAGE SCORING (developer scores subcontractors against benchmarks) ──
function ScoreBar({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', width: 150, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${(value / 5) * 100}%`, height: '100%', background: 'var(--gold)' }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, width: 20, textAlign: 'right' }}>{value}</div>
    </div>
  );
}

function StageRow({ stage, isDev, onAssign, onScore }) {
  const [assignEmail, setAssignEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [scoring, setScoring] = useState(false);
  const [vals, setVals] = useState({ ontime: 3, quality: 3, budget: 3, safety: 3 });
  const [notes, setNotes] = useState('');

  const statusColor = { unassigned: '#999', assigned: '#3498db', scored: '#27ae60' }[stage.status] || '#999';

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 16, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17 }}>{stage.name}</div>
        <span style={{ fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: statusColor, border: `1px solid ${statusColor}`, padding: '2px 8px', borderRadius: 10 }}>{stage.status}</span>
      </div>

      {stage.subcontractorName && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
          Subcontractor: <strong>{stage.subcontractorName}</strong>
          {stage.dueDate ? ` · Due ${new Date(stage.dueDate).toLocaleDateString('en-AU')}` : ''}
        </div>
      )}

      {isDev && stage.status === 'unassigned' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input className="fi" placeholder="Subcontractor email" value={assignEmail} onChange={e => setAssignEmail(e.target.value)} style={{ flex: 1, minWidth: 180, color: '#111', background: '#fafafa', borderColor: 'rgba(0,0,0,0.15)' }} />
          <input className="fi" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ color: '#111', background: '#fafafa', borderColor: 'rgba(0,0,0,0.15)' }} />
          <button className="btn btn-d btn-sm" onClick={() => onAssign(stage.id, assignEmail, dueDate)} disabled={!assignEmail}>Assign</button>
        </div>
      )}

      {isDev && stage.status === 'assigned' && !scoring && (
        <button className="btn btn-d btn-sm" onClick={() => setScoring(true)}>Score This Stage →</button>
      )}

      {isDev && scoring && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {stage.benchmarks.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 11, width: 150, flexShrink: 0 }}>{b.label}</div>
              <input type="range" min="1" max="5" value={vals[b.id]} onChange={e => setVals(v => ({ ...v, [b.id]: Number(e.target.value) }))} style={{ flex: 1 }} />
              <div style={{ fontSize: 12, fontWeight: 600, width: 16 }}>{vals[b.id]}</div>
            </div>
          ))}
          <textarea className="fi" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', minHeight: 50, marginTop: 4, color: '#111', background: '#fafafa', borderColor: 'rgba(0,0,0,0.15)' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-g btn-sm" onClick={() => { onScore(stage.id, vals, notes); setScoring(false); }}>Submit Score</button>
            <button className="btn btn-o btn-sm" onClick={() => setScoring(false)}>Cancel</button>
          </div>
        </div>
      )}

      {stage.status === 'scored' && stage.score && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, marginBottom: 8 }}>Overall: <strong style={{ color: 'var(--gold)', fontSize: 16 }}>{stage.score.overall}/5</strong></div>
          {stage.benchmarks.map(b => <ScoreBar key={b.id} label={b.label} value={stage.score.values[b.id] || 0} />)}
          {stage.score.notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, fontStyle: 'italic' }}>"{stage.score.notes}"</div>}
        </div>
      )}
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

            {/* FEASO Actuals vs Forecast — shown once construction commenced */}
            {(l.status === 'active' || l.status === 'construction') ? (
              <div style={{ marginTop: 24, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 20 }}>
                <div style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>FEASO — Live Actuals vs Forecast</div>
                {[
                  ['Construction Cost', l.forecastCost || '—', l.actualCost || 'In progress', l.costVariance],
                  ['Average Sale Price', l.forecastSalePrice || '—', l.actualSalePrice || 'In progress', l.priceVariance],
                  ['Completion Date', l.forecastCompletion || '—', l.actualCompletion || 'In progress', l.timeVariance],
                  ['Gross Margin', l.forecastMargin || '—', l.actualMargin || 'In progress', l.marginVariance],
                ].map(([label, forecast, actual, variance]) => {
                  const varNum = parseFloat(variance);
                  const varColor = !variance ? 'var(--muted)' : varNum > 10 ? '#C0392B' : varNum > 5 ? '#E67E22' : '#27AE60';
                  return (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 11 }}>
                      <span style={{ color: 'var(--muted)', flex: 1 }}>{label}</span>
                      <span style={{ color: 'var(--muted)', flex: 1, textAlign: 'center' }}>Forecast: {forecast}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 500, flex: 1, textAlign: 'center' }}>Actual: {actual}</span>
                      {variance && <span style={{ color: varColor, fontWeight: 600, fontSize: 10 }}>{varNum > 0 ? '+' : ''}{variance}%</span>}
                    </div>
                  );
                })}
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, fontStyle: 'italic' }}>
                  Updated from QS progress reports. Last updated: {l.actualsUpdated ? new Date(l.actualsUpdated).toLocaleDateString('en-AU') : 'Pending first QS report'}.
                </div>
              </div>
            ) : null}
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

  const TABS = [['certs', '📄 Wholesale Certs'], ['subs', '💳 Subscriptions'], ['reviews', '📋 IM Reviews'], ['leads', '📊 Leads'], ['users', '👥 Users'], ['actuals', '📊 FEASO Actuals'], ['valuations', '🏛 Completion Valuations']];

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

      {/* ── WHOLESALE CERTS ── */}
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

      {/* ── SUBSCRIPTIONS ── */}
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

      {/* ── IM REVIEWS ── */}
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

      {/* ── LEADS ── */}
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

      {/* ── USERS ── */}
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
      {/* ── FEASO ACTUALS ── */}
      {!loading && tab === 'actuals' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Update actual construction costs, sale prices, and timelines from QS progress reports. Investors see these updates in their deal dashboard.</div>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 24 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Update FEASO Actuals — Active Deal</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['actualCost','Actual Construction Cost (e.g. $3.2M)'],['actualSalePrice','Actual Avg Sale Price (e.g. $485,000)'],['actualMargin','Actual Margin on Cost (e.g. 21.4%)'],['actualCompletion','Actual/Expected Completion (e.g. Q3 2026)'],['costVariance','Cost Variance % (e.g. +3.2)'],['priceVariance','Price Variance % (e.g. -1.8)'],['timeVariance','Timeline Variance % (e.g. +8.0)'],['marginVariance','Margin Variance % (e.g. -2.1)']].map(([k,l]) => (
                <div className="fg" key={k}>
                  <label className="fl">{l}</label>
                  <input className="fi" placeholder={l} />
                </div>
              ))}
            </div>
            <div className="fg" style={{ marginTop: 4 }}>
              <label className="fl">QS Report Reference</label>
              <input className="fi" placeholder="e.g. QS-Progress-Report-2-June2026.pdf" />
            </div>
            <button className="btn btn-g" style={{ marginTop: 8 }}>Save Actuals — Investors Notified</button>
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)' }}>Saving actuals sends an automated update notification to all investors in this deal.</div>
          </div>
        </div>
      )}

      {/* ── COMPLETION VALUATIONS ── */}
      {!loading && tab === 'valuations' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>For deals above $5M GRV — upload independent registered valuer completion report before waterfall distribution is approved.</div>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 24 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Completion Valuation Gate</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>The independent valuation must be uploaded and admin-approved before the trustee can release any waterfall distribution to investors.</p>
            <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Valuation Requirements</div>
              {['Registered valuer — must be registered with the Australian Property Institute (API)','Desktop or full valuation — as determined by deal size and trustee requirements','Valuation date — within 30 days of practical completion','Valuation basis — market value of completed units/lots','Report format — PDF, signed by the registered valuer'].map((r,i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: 'var(--gold)' }}>→</span><span>{r}</span>
                </div>
              ))}
            </div>
            <div className="fg"><label className="fl">Valuation Report (PDF)</label>
              <input type="file" className="fi" accept=".pdf" style={{ paddingTop: 8 }} />
            </div>
            <div className="fg"><label className="fl">Registered Valuer Name and API Number</label>
              <input className="fi" placeholder="e.g. John Smith AAPI — API12345678" />
            </div>
            <div className="fg"><label className="fl">Valuation Date</label>
              <input className="fi" type="date" />
            </div>
            <div className="fg"><label className="fl">Gross Realisable Value — Valuer's Assessment</label>
              <input className="fi" placeholder="e.g. $11,400,000" />
            </div>
            <button className="btn btn-g" style={{ marginTop: 8 }}>Upload Valuation — Unlock Distribution Review</button>
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>Uploading the valuation makes it visible to all investors in this deal. The waterfall distribution cannot be released until this valuation is uploaded and approved.</div>
          </div>
        </div>
      )}

    </sec>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState(window.__pddStartPage || 'home');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
  const [filter, setFilter] = useState('All');
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [sel, setSel] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authDefaultRole, setAuthDefaultRole] = useState(null);
  const openAuth = (role) => { setAuthDefaultRole(role); setShowAuth(true); };
  const [showComp, setShowComp] = useState(false);
  const [showEOI, setShowEOI] = useState(false);
  const [toast, setToast] = useState(null);
  const [pDone, setPDone] = useState(false);
  const [pf, setPf] = useState({ company: '', name: '', email: '', phone: '', type: '', raise: '' });
  const [devListings, setDevListings] = useState([]);
  const [stageListingId, setStageListingId] = useState(null);
  const [stages, setStages] = useState([]);
  const [myStages, setMyStages] = useState(null);

  const showT = msg => { setToast(msg); setTimeout(() => setToast(null), 3500); };
  const go = pg => { setPage(pg); window.scrollTo && window.scrollTo(0, 0); };
  const invest = () => { if (!user) { setShowAuth(true); return; } setShowComp(true); };
  const setP = (k, v) => setPf(p => ({ ...p, [k]: v }));

  // Load current user session
  useEffect(() => {
    API.get('/api/auth/me').then(res => {
      if (res && !res.error) setUser(res.user || null);
    }).catch(() => {});
  }, []);

  // Load listings when on listings/home page
  useEffect(() => {
    if (page === 'listings' || page === 'home') {
      setLoadingListings(true);
      API.get('/api/listings').then(res => {
        if (Array.isArray(res)) setListings(res.map(normaliseListing));
        setLoadingListings(false);
      }).catch(() => setLoadingListings(false));
    }
  }, [page]);

  // Dashboard data: developer's own listings, or a subcontractor's assigned stages
  useEffect(() => {
    if ((page !== 'dashboard' && page !== 'stages') || !user) return;
    if (user.role === 'developer' || user.role === 'admin') {
      API.get('/api/listings').then(res => {
        if (Array.isArray(res)) setDevListings(res.filter(l => l.devId === user.id));
      });
    }
    if (user.role === 'subcontractor') {
      API.get('/api/my/stages').then(res => { if (res && !res.error) setMyStages(res); });
    }
  }, [page, user]);

  // Stages for whichever listing the developer has expanded
  useEffect(() => {
    if (!stageListingId) { setStages([]); return; }
    API.get(`/api/listings/${stageListingId}/stages`).then(res => { if (Array.isArray(res)) setStages(res); });
  }, [stageListingId]);

  const initStages = async (listingId) => {
    const res = await API.post(`/api/listings/${listingId}/stages/init`, {});
    if (res.error) { showT(res.error); return; }
    setStageListingId(listingId);
    setStages(res.stages);
  };

  const assignStage = async (stageId, email, dueDate) => {
    const res = await API.put(`/api/listings/${stageListingId}/stages/${stageId}/assign`, { subcontractorEmail: email, dueDate });
    if (res.error) { showT(res.error); return; }
    setStages(s => s.map(x => x.id === stageId ? res.stage : x));
    showT('Subcontractor assigned.');
  };

  const scoreStage = async (stageId, values, notes) => {
    const res = await API.post(`/api/listings/${stageListingId}/stages/${stageId}/score`, { values, notes });
    if (res.error) { showT(res.error); return; }
    setStages(s => s.map(x => x.id === stageId ? res.stage : x));
    showT('Stage scored.');
  };

  // PWA install prompt
  useEffect(() => {
    const onReady = () => { setInstallPrompt(window.__pddInstallPrompt); setShowInstall(true); };
    const onInstalled = () => { setShowInstall(false); setAppInstalled(true); };
    window.addEventListener('pdd-install-ready', onReady);
    window.addEventListener('pdd-installed', onInstalled);
    if (window.matchMedia('(display-mode: standalone)').matches) { setAppInstalled(true); setShowInstall(false); }
    return () => { window.removeEventListener('pdd-install-ready', onReady); window.removeEventListener('pdd-installed', onInstalled); };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setShowInstall(false); setAppInstalled(true); }
    setInstallPrompt(null);
    window.__pddInstallPrompt = null;
  };

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
      {/* ── PWA INSTALL BANNER ── */}
      {showInstall && !appInstalled && (
        <div style={{ background:'rgba(201,168,76,0.95)', padding:'10px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', zIndex:300, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src="/logo.png" alt="" style={{ height:32, width:'auto' }} />
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'#0D0D0D', lineHeight:1.2 }}>Install Prop Dev DNA</div>
              <div style={{ fontSize:10, color:'rgba(13,13,13,0.65)', lineHeight:1.4 }}>Add to your home screen for the full app experience</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleInstall} style={{ background:'#0D0D0D', color:'var(--gold)', border:'none', padding:'8px 18px', fontSize:10, fontWeight:500, letterSpacing:'1.5px', textTransform:'uppercase', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              Install App
            </button>
            <button onClick={() => setShowInstall(false)} style={{ background:'transparent', border:'1px solid rgba(13,13,13,0.25)', color:'#0D0D0D', padding:'8px 12px', fontSize:11, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* LOGO WATERMARK — fixed, centred, behind all content */}
      <img src="/logo.png" alt=""
        style={{ position:'fixed', left:'50%', top:'50%', transform:'translate(-50%, -50%)', width:600, height:600, objectFit:'contain', opacity:0.06, zIndex:0, pointerEvents:'none' }}
        onError={e => { e.target.style.display='none'; }}
      />

      {/* LOGO HEADER — wordmark only, left-aligned */}
      <div style={{ background:'#0D0D0D', padding:'20px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(201,168,76,0.2)', zIndex:200, position:'relative' }}>
        <button onClick={() => go('home')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'flex-start', padding:0 }}>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:700, color:'var(--gold)', lineHeight:1.1, letterSpacing:'-0.5px' }}>Prop Dev DNA</span>
          <span style={{ fontSize:10, letterSpacing:'3px', textTransform:'uppercase', color:'rgba(201,168,76,0.55)', marginTop:6, fontWeight:300 }}>Where Performance Meets Accountability</span>
        </button>
        <div style={{ fontSize:10, color:'rgba(245,242,236,0.3)', textAlign:'right' }}>
          <strong style={{ color:'rgba(201,168,76,0.5)' }}>Wholesale &amp; Sophisticated Investors Only</strong><br />
          <span>s.761G Corporations Act 2001 (Cth) · General information only · Not financial product advice</span>
        </div>
      </div>

      {/* NAV — sticky, centred links */}
      <nav style={{ position:'sticky', top:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 32px', height:46, background:'rgba(13,13,13,0.98)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(201,168,76,0.1)', gap:36 }}>
        <button className="nl" onClick={() => go('listings')}>Opportunities</button>
        <button className="nl" onClick={() => go('portal')}>Developers</button>
        <button className="nl" onClick={() => go('partners')}>Partners</button>
        <button className="nl" onClick={() => go('tiers')}>Investor Tiers</button>
        <button className="nl" onClick={() => go('pricing')}>Pricing</button>
        <button className="nl" onClick={() => go('compliance')}>Compliance</button>
        <button className="nl" onClick={() => go('developers')}>Track Record</button>
        <button className="nl" onClick={() => go('stages')}>Stage Scoring</button>
        <button className="nl" onClick={() => go('about')}>About</button>
        {showInstall && !appInstalled && (
          <button onClick={handleInstall} style={{ background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.3)', color:'var(--gold)', fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', padding:'6px 12px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginLeft:8 }}>
            ⬇ Install App
          </button>
        )}
        {user
          ? <>
            {user.role === 'admin' && <button className="nl" style={{ color: '#e74c3c' }} onClick={() => go('admin')}>⚙ Admin</button>}
            <button className="nl" style={{ color: 'var(--gold)' }} onClick={() => go('dashboard')}>My Account</button>
            <button className="nl" onClick={logout}>Sign Out</button>
          </>
          : <button className="nl cta" onClick={() => setShowAuth(true)}>Sign In</button>
        }
      </nav>

      {/* ── HOME ── */}
      {page === 'home' && <>

        {/* ══ SIZZLE HERO — split two audiences ══ */}
        <div className="sizzle-hero" style={{ position:'relative', minHeight:'92vh', display:'flex', overflow:'hidden', background:'#050505' }}>

          {/* Particle grid */}
          <div style={{ position:'absolute', inset:0, zIndex:1, backgroundImage:'radial-gradient(circle, rgba(201,168,76,0.06) 1px, transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none' }} />

          {/* Centre divider */}
          <div className="sizzle-divider" style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'linear-gradient(to bottom, transparent, rgba(201,168,76,0.5) 30%, rgba(201,168,76,0.9) 50%, rgba(201,168,76,0.5) 70%, transparent)', zIndex:10, transform:'translateX(-50%)' }} />
          <div className="sizzle-medallion" style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', zIndex:11, background:'rgba(5,5,5,0.9)', border:'1px solid rgba(201,168,76,0.5)', borderRadius:'50%', width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'var(--gold)', lineHeight:1 }}>⊕</span>
          </div>

          {/* LEFT — INVESTORS */}
          <div className="sizzle-left" style={{ flex:'0 0 50%', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'center', zIndex:2 }}>
            <img src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=85&fit=crop&auto=format" alt="Investor returns" loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.15 }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, #050505 0%, #0a0a0a 65%, rgba(201,168,76,0.03) 100%)' }} />
            <div style={{ position:'relative', zIndex:2, padding:'56px 48px 80px 56px' }}>

              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(201,168,76,0.08)', border:'1px solid rgba(201,168,76,0.25)', padding:'6px 14px', marginBottom:24 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--gold)', display:'block' }} />
                <span style={{ fontSize:9, letterSpacing:'3px', textTransform:'uppercase', color:'var(--gold)' }}>For Wholesale Investors</span>
              </div>

              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(26px,3vw,46px)', fontWeight:600, color:'#fff', lineHeight:1.05, marginBottom:16, letterSpacing:'-0.3px' }}>
                Development Returns.<br /><em style={{ color:'var(--gold)', fontStyle:'italic' }}>Without the Guesswork.</em>
              </h2>

              <p style={{ fontSize:13, color:'rgba(245,242,236,0.55)', lineHeight:1.85, marginBottom:24, maxWidth:360 }}>
                Curated deals that pass independent FEASO review, QS certification, and admin approval — before you see a single number. Performance with accountability built in.
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:0, marginBottom:28 }}>
                {[
                  ['🎯','18–26% target IRR','Returns above term deposits, bonds, and most listed equities'],
                  ['✅','s.761G verified access only','Wholesale-only deals not available to retail investors'],
                  ['🔒','Independent trust per deal','Your capital never held by the platform — always in trust'],
                  ['📋','FEASO-verified listings','Every deal stress-tested before you see it — min 15% margin on cost'],
                  ['⚖️','Investor-first waterfall','You are repaid principal and preferred return before developer profit'],
                  ['🏛','AFSL 479499 regulated','DFP Corporate Pty Ltd — licensed since 2015, audited by Hall Chadwick'],
                ].map(([icon,title,desc]) => (
                  <div key={title} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(201,168,76,0.07)' }}>
                    <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:500, color:'rgba(245,242,236,0.88)', marginBottom:2 }}>{title}</div>
                      <div style={{ fontSize:10, color:'rgba(245,242,236,0.32)', lineHeight:1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:24, paddingTop:18, borderTop:'1px solid rgba(201,168,76,0.1)', marginBottom:24, flexWrap:'wrap' }}>
                {[['18–26%','Target IRR'],['$140M+','Deal Network'],['4','Investor Tiers'],['s.761G','Verified Only']].map(([n,l]) => (
                  <div key={l}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:'var(--gold)', lineHeight:1 }}>{n}</div>
                    <div style={{ fontSize:8, letterSpacing:'2px', textTransform:'uppercase', color:'rgba(245,242,236,0.28)', marginTop:3 }}>{l}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button className="btn btn-g" onClick={() => go('listings')}>Browse Opportunities →</button>
                <button className="btn btn-o" onClick={() => user ? go('dashboard') : setShowAuth(true)}>Verify My Status</button>
              </div>
            </div>
          </div>

          {/* RIGHT — DEVELOPERS / BUILDERS / BUYERS AGENTS */}
          <div className="sizzle-right" style={{ flex:'0 0 50%', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'center', zIndex:2 }}>
            <img src="https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=900&q=85&fit=crop&auto=format" alt="Development capital" loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.18 }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(225deg, #050505 0%, #0d0d0a 65%, rgba(42,58,46,0.12) 100%)' }} />
            <div style={{ position:'relative', zIndex:2, padding:'56px 56px 80px 48px' }}>

              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(42,58,46,0.25)', border:'1px solid rgba(74,140,92,0.4)', padding:'6px 14px', marginBottom:24 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#4a8c5c', display:'block' }} />
                <span style={{ fontSize:9, letterSpacing:'3px', textTransform:'uppercase', color:'#7ab88a' }}>Developers · Builders · Buyers Agents</span>
              </div>

              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(26px,3vw,46px)', fontWeight:600, color:'#fff', lineHeight:1.05, marginBottom:16, letterSpacing:'-0.3px' }}>
                Capital. Presales.<br /><em style={{ color:'#7ab88a', fontStyle:'italic' }}>Full Stack.</em>
              </h2>

              <p style={{ fontSize:13, color:'rgba(245,242,236,0.55)', lineHeight:1.85, marginBottom:24, maxWidth:360 }}>
                One platform. Subordinated capital raised. Senior debt arranged through DFP. Development stock presold to verified wholesale investors before public launch.
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:0, marginBottom:28 }}>
                {[
                  ['🏗','Raise subordinated capital','Mezzanine, preferred equity, and JV equity from verified wholesale investors'],
                  ['🏦','Full capital stack — PDD + DFP','Subordinated capital plus senior debt — one conversation, one relationship'],
                  ['🏠','Presale your development stock','Platform investors get VIP first access — satisfies lender presale requirements'],
                  ['📋','FEASO builder built in','Complete your feasibility on platform — IM generated automatically for investors'],
                  ['⚡','Live within 48 hours','Pass quality review and reach verified wholesale investors fast'],
                  ['🤝','Buyers agents — refer clients','Introduce buyer clients to VIP presale access — earn referral income on settlement'],
                ].map(([icon,title,desc]) => (
                  <div key={title} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(42,58,46,0.25)' }}>
                    <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:500, color:'rgba(245,242,236,0.88)', marginBottom:2 }}>{title}</div>
                      <div style={{ fontSize:10, color:'rgba(245,242,236,0.32)', lineHeight:1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:24, paddingTop:18, borderTop:'1px solid rgba(42,58,46,0.35)', marginBottom:24, flexWrap:'wrap' }}>
                {[['1.5%','Success Fee'],['$299/mo','Subscription'],['48hr','Go Live'],['QS Cert','Above $2M']].map(([n,l]) => (
                  <div key={l}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:'#7ab88a', lineHeight:1 }}>{n}</div>
                    <div style={{ fontSize:8, letterSpacing:'2px', textTransform:'uppercase', color:'rgba(245,242,236,0.28)', marginTop:3 }}>{l}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button className="btn btn-g" onClick={() => go('portal')}>Submit Your Project →</button>
                <button className="btn btn-o" onClick={() => go('compliance')}>View Compliance Framework</button>
              </div>
            </div>
          </div>

          {/* Tagline bar */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:12, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(12px)', borderTop:'1px solid rgba(201,168,76,0.15)', padding:'10px 48px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div style={{ fontSize:10, letterSpacing:'3px', textTransform:'uppercase', color:'rgba(201,168,76,0.55)' }}>Where Performance Meets Accountability</div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {[[`${listings.length || '6'} Live Deals`,'var(--gold)'],['AFSL 479499','rgba(245,242,236,0.35)'],['s.761G Verified','rgba(245,242,236,0.35)'],['Independent Trust','rgba(245,242,236,0.35)']].map(([t,c]) => (
                <div key={t} style={{ fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:c }}>{t}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COMPLIANCE BADGES ── */}
        <sec style={{ background:'#050505', padding:'20px 32px', borderTop:'1px solid rgba(201,168,76,0.15)', borderBottom:'1px solid rgba(201,168,76,0.08)' }}>
          <div style={{ display:'flex', justifyContent:'center', alignItems:'stretch', gap:1, background:'rgba(201,168,76,0.08)', flexWrap:'wrap' }}>
            {[
              { icon:'🛡', title:'AFSL 479499', sub:'Regulated under DFP Corporate Pty Ltd' },
              { icon:'📋', title:'FEASO Verified', sub:'Every deal independently feasibility-checked' },
              { icon:'✅', title:'s.761G Verified', sub:'Wholesale investors only — Corporations Act 2001' },
              { icon:'🔒', title:'Independent Trust', sub:'Investor funds never held by this platform' },
              { icon:'📨', title:'ASIC Engaged', sub:'Innovation Hub enquiry lodged June 2026' },
            ].map(b => (
              <div key={b.title} onClick={() => go('compliance')}
                style={{ flex:'1 1 160px', background:'#0a0a0a', padding:'16px 20px', cursor:'pointer', textAlign:'center', transition:'background 0.2s', minWidth:140 }}
                onMouseEnter={e => e.currentTarget.style.background='#111'}
                onMouseLeave={e => e.currentTarget.style.background='#0a0a0a'}>
                <div style={{ fontSize:22, marginBottom:6 }}>{b.icon}</div>
                <div style={{ fontSize:11, fontWeight:500, color:'var(--gold)', letterSpacing:'1px', marginBottom:4 }}>{b.title}</div>
                <div style={{ fontSize:10, color:'rgba(245,242,236,0.4)', lineHeight:1.5 }}>{b.sub}</div>
              </div>
            ))}
          </div>
        </sec>

        {/* ══ ACCOUNTABILITY SECTION — full bleed visual cards ══ */}
        <sec style={{ background:'var(--paper)', padding:'80px 0 0' }}>
          <div style={{ textAlign:'center', padding:'0 32px 48px' }}>
            <div className="slbl">Why Prop Dev DNA</div>
            <div className="stitle" style={{ marginBottom:16 }}>Where Performance Meets Accountability</div>
            <p style={{ fontSize:15, color:'var(--muted)', maxWidth:600, margin:'0 auto', lineHeight:1.85 }}>
              Every competing platform that has failed wholesale investors did so because accountability was optional. On Prop Dev DNA it is structural — built into the platform before any investor sees a single deal.
            </p>
          </div>

          {/* Three full-bleed visual accountability cards */}
          <div className="acc-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2, background:'rgba(0,0,0,0.08)' }}>
            {[
              {
                img:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=85&fit=crop&auto=format',
                color:'#C9A84C',
                badge:'FEASIBILITY ACCOUNTABILITY',
                title:'Every Number Verified Before Listing',
                lead:'No developer can publish a deal until their feasibility passes our independent review. VentureCrowd accepted a 7.1% margin feasibility without review and listed it to investors. That deal collapsed. We built the system that makes this impossible.',
                points:[
                  ['Live FEASO Builder','Developer completes every input on platform — land cost, construction, fees, finance, sales, holding — all locked and versioned on submission. No offline spreadsheets accepted.'],
                  ['Margin Gate','Platform calculates margin on cost in real time. Below 15% — blocked automatically, deal cannot proceed. 15–20% — mandatory admin review with documented decision. Above 20% — approved to continue.'],
                  ['Independent QS Certification','For every raise above $2,000,000 — an independent Quantity Surveyor registered with the AIQS must certify construction cost inputs before the deal goes live. Admin cross-checks every input against the QS report.'],
                  ['Admin Sign-Off','A human reviews every FEASO before any investor sees it. The review is documented — reviewer name, date, inputs assessed, decision recorded — and retained for 7 years minimum.'],
                  ['Locked Inputs','Once submitted, FEASO inputs are locked. The developer cannot alter numbers after admin review commences. Version history maintained.'],
                ],
                stat:'15%',
                statLabel:'Minimum margin on cost to list'
              },
              {
                img:'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=85&fit=crop&auto=format',
                color:'#27AE60',
                badge:'INVESTOR ACCOUNTABILITY',
                title:'Every Investor Verified Before Access',
                lead:'Not everyone who wants to invest in development finance should. The s.761G wholesale investor framework exists for a reason — development deals carry risk that retail investors are not equipped to assess. Our four-tier verification enforces this without exception.',
                points:[
                  ['s.761G Certificate Mandatory','Every investor must submit an accountant certificate confirming net assets of at least $2.5M or gross income of at least $250,000 p.a. Signed by a current CPA Australia, CA ANZ, or IPA member — on letterhead, dated within 2 years.'],
                  ['Accountant Membership Verified','Admin verifies the certifying accountant\'s membership number on the relevant professional body\'s public register before approving the certificate. No unverified certificates accepted.'],
                  ['Four-Tier Access System','Tier 1 — Registered. Tier 2 — Wholesale Verified (s.761G approved). Tier 3 — Funds Verified (proof of funds confirmed). Tier 4 — PDD Endorsed (personally pre-qualified by Anthony Lawson, licensed mortgage broker). Deal access scales with tier.'],
                  ['Timestamped Risk Acknowledgment','Before any expression of interest can be submitted — every investor completes a mandatory risk acknowledgment. Capital loss, illiquidity, no guarantee of returns, wholesale confirmation. Timestamped, IP-logged, stored per deal per investor.'],
                  ['Certificate Expiry Enforced','All certificates expire 2 years from issue date. Platform sends automated renewal reminders 60 days before expiry. Lapsed certificates — Tier 2 access suspended until renewed.'],
                ],
                stat:'4',
                statLabel:'Verification tiers before capital commitment'
              },
              {
                img:'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=90&fit=crop&auto=format',
                color:'#4A90D9',
                badge:'CAPITAL ACCOUNTABILITY',
                title:'Your Money Never Touches This Platform',
                lead:'The single biggest structural failure in alternative investment platforms is fund mishandling. Prop Dev DNA eliminates this risk entirely — not through policy, but through structure. Your capital never enters our accounts at any point.',
                points:[
                  ['Independent Trust Per Deal','Each development opportunity has its own independent trust established before capital is raised. One trust per deal. Independent trustee appointed — not Prop Dev DNA, not the developer.'],
                  ['Solicitor\'s Trust Account','During the raise period, committed investor funds are held in a solicitor\'s trust account or the trust\'s dedicated bank account — not accessible by Prop Dev DNA under any circumstances.'],
                  ['Minimum Raise Protection','If the minimum raise target is not met by the close date — all committed capital is returned to investors in full within 5 business days. No exceptions. No deductions.'],
                  ['Investor-First Waterfall','On deal completion: senior debt repaid first, then development costs, then investor principal, then investor preferred return, then platform success fee, then developer profit. Investors are always paid before the developer takes a dollar.'],
                  ['AFSL 479499 Regulated','Platform operates as a Corporate Authorised Representative of DFP Corporate Pty Ltd (AFSL 479499) — licensed since November 2015 and audited annually by Hall Chadwick. ASIC Innovation Hub engaged proactively — June 2026.'],
                ],
                stat:'$0',
                statLabel:'Investor capital ever held by Prop Dev DNA'
              },
            ].map((card,i) => (
              <div key={card.badge} style={{ position:'relative', overflow:'hidden', background:'#0a0a0a' }}>
                {/* Full bleed image */}
                <div style={{ height:280, position:'relative', overflow:'hidden' }}>
                  <img src={card.img} alt={card.title} style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.4, transition:'opacity 0.4s' }}
                    onMouseEnter={e => e.target.style.opacity=0.6}
                    onMouseLeave={e => e.target.style.opacity=0.4}
                  />
                  <div style={{ position:'absolute', inset:0, background:`linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.98) 100%)` }} />
                  {/* Floating stat */}
                  <div style={{ position:'absolute', top:20, right:20, background:'rgba(0,0,0,0.7)', border:`1px solid ${card.color}`, padding:'12px 16px', backdropFilter:'blur(8px)' }}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:600, color:card.color, lineHeight:1 }}>{card.stat}</div>
                    <div style={{ fontSize:8, letterSpacing:'1.5px', textTransform:'uppercase', color:'rgba(245,242,236,0.4)', marginTop:4, maxWidth:100, lineHeight:1.4 }}>{card.statLabel}</div>
                  </div>
                  {/* Badge */}
                  <div style={{ position:'absolute', bottom:20, left:20 }}>
                    <div style={{ fontSize:8, letterSpacing:'2.5px', textTransform:'uppercase', color:card.color, marginBottom:8 }}>{card.badge}</div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:'#fff', lineHeight:1.2, maxWidth:260 }}>{card.title}</div>
                  </div>
                </div>

                {/* Lead paragraph */}
                <div style={{ padding:'24px 24px 0', borderTop:`3px solid ${card.color}` }}>
                  <p style={{ fontSize:13, color:'rgba(245,242,236,0.6)', lineHeight:1.85, marginBottom:24 }}>{card.lead}</p>

                  {/* Detail points */}
                  <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {card.points.map(([title,detail]) => (
                      <details key={title} style={{ borderTop:'1px solid rgba(255,255,255,0.06)', cursor:'pointer' }}>
                        <summary style={{ padding:'13px 0', fontSize:12, fontWeight:500, color:'rgba(245,242,236,0.85)', listStyle:'none', display:'flex', justifyContent:'space-between', alignItems:'center', userSelect:'none' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ width:5, height:5, borderRadius:'50%', background:card.color, display:'block', flexShrink:0 }} />
                            {title}
                          </span>
                          <span style={{ color:card.color, fontSize:16, fontWeight:300, transition:'transform 0.2s', display:'inline-block' }}>+</span>
                        </summary>
                        <div style={{ padding:'0 0 16px 13px', fontSize:12, color:'rgba(245,242,236,0.45)', lineHeight:1.75 }}>{detail}</div>
                      </details>
                    ))}
                  </div>

                  <div style={{ padding:'20px 0 24px', borderTop:'1px solid rgba(255,255,255,0.06)', marginTop:4 }}>
                    <button className="btn btn-o btn-sm" onClick={() => go('compliance')} style={{ width:'100%', justifyContent:'center' }}>
                      View Full Compliance Framework →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom accountability bar */}
          <div style={{ background:'var(--ink)', padding:'28px 48px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:20 }}>
            <div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'#fff', marginBottom:6 }}>The Standard No Competitor Has Matched</div>
              <div style={{ fontSize:13, color:'rgba(245,242,236,0.4)', maxWidth:680, lineHeight:1.7 }}>
                VentureCrowd accepted a 7.1% margin feasibility without independent review and listed it to investors — that deal failed. MBI has no FEASO process. Investing Platform has no verification framework. Prop Dev DNA blocks non-viable deals before investors ever see them — structurally, not contractually.
              </div>
            </div>
            <button className="btn btn-g" onClick={() => go('compliance')}>View Full Compliance Framework →</button>
          </div>
        </sec>

        {/* ══ FOUR TIERS ══ */}
        <sec style={{ background: '#0a0a0a', padding: '48px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
            <div>
              <div className="slbl">Investor Verification</div>
              <div className="stitle" style={{ color: '#fff', marginBottom: 0 }}>Four Tiers of Trust</div>
            </div>
            <button className="btn btn-o btn-sm" onClick={() => go('tiers')}>Learn More →</button>
          </div>
          <div className="tiers-grid-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'rgba(201,168,76,0.07)' }}>
            {Object.entries(TIERS).map(([key, t]) => (
              <div key={key} style={{ background: '#0f0f0f', padding: '20px 16px' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{t.badge}</div>
                <div style={{ fontSize: 13, fontFamily: "'Cormorant Garamond',serif", color: '#fff', fontWeight: 600, marginBottom: 6 }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(245,242,236,0.35)', lineHeight: 1.6 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </sec>

        <sec className="how-sec">
          <div className="slbl">The Platform</div>
          <div className="stitle" style={{ color: '#fff' }}>Built for Serious Capital</div>
          <p className="ssub" style={{ color: 'rgba(245,242,236,0.38)' }}>From feasibility to funded — three steps.</p>
          <div className="steps">
            {[{ n: '01', i: '🔍', t: 'Discover', d: 'Browse FEASO-reviewed opportunities by state, stage, and return profile.' },
            { n: '02', i: '📊', t: 'Analyse', d: 'Access full IMs, feasibility reports, and developer profiles.' },
            { n: '03', i: '✅', t: 'Invest', d: 'Register interest, complete verification, and confirm your allocation.' }
            ].map(s => (
              <div className="step" key={s.n}>
                <div className="stn">{s.n}</div><div className="sti">{s.i}</div><h3>{s.t}</h3><p>{s.d}</p>
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
              {listings.slice(0, 3).map(l => <Card key={l.id} l={l} onClick={() => { setSel(l); go('detail'); }} user={user} />)}
            </div>
          }
        </sec>

        <sec style={{ background: 'var(--sage)', textAlign: 'center' }}>
          <div className="slbl" style={{ color: 'rgba(201,168,76,0.55)' }}>For Developers</div>
          <div className="stitle" style={{ color: '#fff', maxWidth: 520, margin: '0 auto 14px' }}>Ready to Raise Capital for Your Next Project?</div>
          <p className="ssub" style={{ color: 'rgba(255,255,255,0.38)', margin: '0 auto 32px' }}>FEASO builder + IM generator + verified wholesale investor network.</p>
          <button className="btn btn-g" onClick={() => go('portal')}>Submit Your Project →</button>
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
              : <div className="grid">{filtered.map(l => <Card key={l.id} l={l} onClick={() => { setSel(l); go('detail'); }} user={user} />)}</div>
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
      {page === 'dashboard' && user && user.role === 'investor' && (
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

      {/* ── STAGE SCORING — explainer for logged-out visitors & investors ── */}
      {page === 'stages' && (!user || user.role === 'investor') && (
        <div>
          <div style={{ background:'var(--ink)', minHeight:'46vh', display:'flex', alignItems:'flex-end', padding:'80px 56px 52px', position:'relative', overflow:'hidden' }}>
            <img src="https://images.unsplash.com/photo-1541976590-713941681591?w=1400&q=85&fit=crop&auto=format" loading="lazy" alt="Construction site" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.18 }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.6) 60%, rgba(13,13,13,0.3) 100%)' }} />
            <div style={{ position:'relative', zIndex:2, maxWidth:720 }}>
              <div className="slbl" style={{ color:'rgba(201,168,76,0.6)', marginBottom:16 }}>For Builders · For Subcontractors</div>
              <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(32px,5vw,58px)', fontWeight:600, color:'#fff', lineHeight:1.05, marginBottom:20, letterSpacing:'-0.5px' }}>
                Every Stage.<br /><em style={{ color:'var(--gold)' }}>Scored On The Record.</em>
              </h1>
              <p style={{ fontSize:15, color:'rgba(245,242,236,0.6)', maxWidth:560, lineHeight:1.85, marginBottom:32 }}>
                Builders assign subcontractors to each standard construction stage. Once a stage is delivered, it's scored against four fixed benchmarks — on-time delivery, quality of workmanship, budget adherence, and safety &amp; compliance. Scores build a verified, portable track record for every trade on the platform.
              </p>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                <button className="btn btn-g" onClick={() => openAuth('developer')}>I'm a Builder — Get Started →</button>
                <button className="btn btn-o" onClick={() => openAuth('subcontractor')}>I'm a Subcontractor — Get Started →</button>
              </div>
            </div>
          </div>

          <div style={{ background:'var(--paper)', padding:'56px', maxWidth:1100, margin:'0 auto' }}>
            <div className="slbl" style={{ color:'rgba(201,168,76,0.7)', marginBottom:16 }}>The Six Standard Stages</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:1, background:'rgba(0,0,0,0.06)', marginBottom:48 }}>
              {['Site Establishment & Demolition','Slab / Foundations','Frame','Lock-up','Fit-Out & Fixing','Practical Completion & Handover'].map((s,i) => (
                <div key={s} style={{ background:'#fff', padding:'20px 18px' }}>
                  <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:'1.5px', marginBottom:6 }}>STAGE {i+1}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16 }}>{s}</div>
                </div>
              ))}
            </div>

            <div className="slbl" style={{ color:'rgba(201,168,76,0.7)', marginBottom:16 }}>The Four Fixed Benchmarks</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:24 }}>
              {[
                ['⏱','On-Time Delivery','Was the stage completed by the agreed date?'],
                ['🏗','Quality of Workmanship','Did the work meet trade standards on inspection?'],
                ['💰','Budget Adherence','Were there unapproved cost variations?'],
                ['🦺','Safety & Compliance','Were WHS and approval requirements met?'],
              ].map(([icon,title,desc]) => (
                <div key={title}>
                  <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, marginBottom:4 }}>{title}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>{desc}</div>
                </div>
              ))}
            </div>

            {user && user.role === 'investor' && (
              <div style={{ marginTop:48, padding:'16px 20px', background:'rgba(201,168,76,0.06)', border:'1px solid rgba(201,168,76,0.2)', fontSize:12, color:'#444', lineHeight:1.7 }}>
                This tool is for builders and registered subcontractors. As an investor, stage scores feed into each project's public track record — visit <button className="nl" style={{ display:'inline', color:'var(--gold)' }} onClick={() => go('developers')}>Track Record</button> to see verified results.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DEVELOPER DASHBOARD — stages & subcontractor scoring ── */}
      {(page === 'dashboard' || page === 'stages') && user && (user.role === 'developer' || user.role === 'admin') && (
        <sec style={{ paddingTop: 80 }}>
          <div style={{ marginBottom: 28 }}>
            <div className="slbl">Developer Dashboard</div>
            <div className="stitle" style={{ marginBottom: 4 }}>Welcome back, {user.fname || user.email}</div>
            <p className="ssub" style={{ margin: 0 }}>Assign subcontractors to each project stage, then score their work against agreed benchmarks once complete.</p>
          </div>

          {devListings.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              You don't have any listings yet. Submit a project via the <button className="nl" style={{ display: 'inline', color: 'var(--gold)' }} onClick={() => go('portal')}>Developers</button> page.
            </div>
          )}

          {devListings.map(l => (
            <div key={l.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', marginBottom: 16 }}>
              <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: stageListingId === l.id ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.loc}</div>
                </div>
                {stageListingId === l.id
                  ? <button className="btn btn-o btn-sm" onClick={() => setStageListingId(null)}>Hide Stages</button>
                  : <button className="btn btn-d btn-sm" onClick={() => initStages(l.id)}>Manage Stages & Scoring →</button>
                }
              </div>
              {stageListingId === l.id && (
                <div style={{ padding: 20 }}>
                  {stages.slice().sort((a, b) => a.order - b.order).map(s => (
                    <StageRow key={s.id} stage={s} isDev onAssign={assignStage} onScore={scoreStage} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </sec>
      )}

      {/* ── SUBCONTRACTOR DASHBOARD — assigned stages & score history ── */}
      {(page === 'dashboard' || page === 'stages') && user && user.role === 'subcontractor' && (
        <sec style={{ paddingTop: 80 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="slbl">Subcontractor Dashboard</div>
              <div className="stitle" style={{ marginBottom: 4 }}>Welcome back, {user.fname || user.email}</div>
              {user.trade && <p className="ssub" style={{ margin: 0 }}>{user.trade}</p>}
            </div>
            {myStages && myStages.avgScore !== null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, color: 'var(--gold)', lineHeight: 1 }}>{myStages.avgScore}<span style={{ fontSize: 16 }}>/5</span></div>
                <div style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)' }}>Your Score · {myStages.scoredCount} stage{myStages.scoredCount === 1 ? '' : 's'} rated</div>
              </div>
            )}
          </div>

          {!myStages || myStages.stages.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              You haven't been assigned to any project stages yet. A developer will assign you once they set up their project.
            </div>
          ) : (
            myStages.stages.slice().sort((a, b) => a.order - b.order).map(s => (
              <div key={s.id} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{s.listingName}</div>
                <StageRow stage={s} isDev={false} onAssign={() => {}} onScore={() => {}} />
              </div>
            ))
          )}
        </sec>
      )}

      {/* ── ADMIN PORTAL ── */}
      {page === 'admin' && user?.role === 'admin' && (
        <AdminPortal toast={showT} />
      )}
      {page === 'admin' && user?.role !== 'admin' && (
        <sec style={{ paddingTop: 80, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div className="stitle">Access Denied</div>
          <p className="ssub" style={{ margin: '0 auto' }}>Admin access required.</p>
        </sec>
      )}

      {/* ── DEVELOPER PORTAL ── */}
      {page === 'portal' && (
        <div>
          {/* DEVELOPER HERO */}
          <div style={{ background:'var(--ink)', minHeight:'52vh', display:'flex', alignItems:'flex-end', padding:'80px 56px 52px', position:'relative', overflow:'hidden' }}>
            <img src="https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=1400&q=85&fit=crop&auto=format" loading="lazy" alt="Development" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.2 }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.6) 60%, rgba(13,13,13,0.3) 100%)' }} />
            <div style={{ position:'relative', zIndex:2, maxWidth:720 }}>
              <div className="slbl" style={{ color:'rgba(201,168,76,0.6)', marginBottom:16 }}>For Developers · Builders · Owner-Builders</div>
              <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(32px,5vw,64px)', fontWeight:600, color:'#fff', lineHeight:1, marginBottom:20, letterSpacing:'-0.5px' }}>
                Your Project.<br /><em style={{ color:'var(--gold)' }}>Fully Funded.</em>
              </h1>
              <p style={{ fontSize:15, color:'rgba(245,242,236,0.6)', maxWidth:560, lineHeight:1.85, marginBottom:32 }}>
                Most developers lose 6–12 months finding subordinated capital. On Prop Dev DNA, verified wholesale investors are ready to deploy — and DFP arranges the senior debt. One platform. Full capital stack. Live in 48 hours.
              </p>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                <button className="btn btn-g" onClick={() => document.getElementById('dev-form').scrollIntoView({behavior:'smooth'})}>Submit Your Project →</button>
                <button className="btn btn-o" onClick={() => go('compliance')}>View Our Standards</button>
              </div>
            </div>
          </div>

          {/* CAPITAL STACK VISUAL */}
          <div style={{ background:'#0a0a0a', padding:'52px 56px' }}>
            <div style={{ maxWidth:1100, margin:'0 auto' }}>
              <div className="slbl" style={{ color:'rgba(201,168,76,0.5)', marginBottom:16 }}>The Full Capital Stack</div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:'#fff', marginBottom:8 }}>One Relationship. Senior Debt + Subordinated Capital.</div>
              <p style={{ fontSize:13, color:'rgba(245,242,236,0.4)', marginBottom:32, maxWidth:560, lineHeight:1.8 }}>Prop Dev DNA raises the subordinated layer. DFP arranges the senior debt. You deal with one team for the entire capital stack.</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:1, background:'rgba(201,168,76,0.08)' }}>
                {[
                  { label:'Developer Equity / Land', pct:'10–15%', color:'#555', who:'You', desc:'Your land contribution or existing equity counts toward the required developer contribution' },
                  { label:'PDD Equity Bridge', pct:'5–15%', color:'#C9A84C', who:'Prop Dev DNA raises', desc:'Wholesale investors provide preferred equity to satisfy lender contribution requirement — sub-$3M projects' },
                  { label:'PDD Mezz / JV Equity', pct:'10–20%', color:'#C9A84C', who:'Prop Dev DNA raises', desc:'Mezzanine or preferred equity raised from the platform investor network — 1.5% success fee on settlement' },
                  { label:'Senior Debt', pct:'60–70%', color:'#4A90D9', who:'DFP arranges', desc:"Construction finance arranged through DFP's lender panel — Baxter Gamble, $3B+ funded" },
                ].map((layer,i) => (
                  <div key={layer.label} style={{ background:i<2?'#0f0f0f':'#0a0a0a', borderTop:`3px solid ${layer.color}`, padding:'24px 20px' }}>
                    <div style={{ fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:layer.color, marginBottom:8 }}>{layer.who}</div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'#fff', marginBottom:6, lineHeight:1.2 }}>{layer.label}</div>
                    <div style={{ fontSize:24, fontWeight:600, color:layer.color, fontFamily:"'Cormorant Garamond',serif", marginBottom:12 }}>{layer.pct}</div>
                    <div style={{ fontSize:11, color:'rgba(245,242,236,0.35)', lineHeight:1.65 }}>{layer.desc}</div>
                  </div>
                ))}
              </div>
              {/* Revenue illustration */}
              <div style={{ marginTop:1, background:'#111', padding:'20px 24px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
                <div style={{ fontSize:12, color:'rgba(245,242,236,0.4)' }}>Illustrative $8M TDC deal — developer retains 70% of net profit after all costs and investor returns</div>
                <div style={{ display:'flex', gap:24 }}>
                  {[['1.5%','PDD success fee'],['$299/mo','Subscription'],['48hr','To go live'],['70%','Developer profit share']].map(([v,l]) => (
                    <div key={l} style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:'var(--gold)' }}>{v}</div>
                      <div style={{ fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:'rgba(245,242,236,0.3)', marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* PROCESS + REQUIREMENTS */}
          <div style={{ background:'var(--paper)', padding:'52px 56px' }}>
            <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'start' }}>
              <div>
                <div className="slbl">How It Works</div>
                <div className="stitle" style={{ marginBottom:20 }}>From Submission to Funded</div>
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {[
                    ['01','Submit your project','Company details, site address, DA status, and capital raise target. Takes 5 minutes.'],
                    ['02','Complete the FEASO builder','Our live feasibility tool calculates your margin on cost, IRR, and debt metrics. Inputs are locked on submission.'],
                    ['03','QS certification','For raises above $2M — engage a registered QS to certify construction costs. We can recommend firms.'],
                    ['04','Admin review','Our team reviews your FEASO, verifies your project details, and generates your Information Memorandum within 48 hours.'],
                    ['05','Go live','Your listing is published to verified wholesale investors. Tier 3 and 4 investors see it first.'],
                    ['06','Capital raised','Investor commitments close. Independent trustee receives funds. Construction begins.'],
                  ].map(([n,t,d]) => (
                    <div key={n} style={{ display:'flex', gap:20, padding:'18px 0', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:'rgba(201,168,76,0.3)', lineHeight:1, flexShrink:0, width:36 }}>{n}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'var(--ink)', marginBottom:4 }}>{t}</div>
                        <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.65 }}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="slbl">What We Require</div>
                <div className="stitle" style={{ marginBottom:20 }}>Our Quality Standards</div>
                <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.85, marginBottom:24 }}>
                  These standards exist to protect investors — and to protect you from association with deals that fail. Every requirement is documented, reviewed, and retained.
                </p>
                {[
                  { icon:'📋', req:'FEASO completion', detail:'All six tabs completed — site, construction, fees, finance, sales, holding. Margin must exceed 15% to proceed.' },
                  { icon:'🔬', req:'QS certification (raises >$2M)', detail:'Independent Quantity Surveyor registered with AIQS certifies construction cost inputs.' },
                  { icon:'📄', req:'DA status confirmed', detail:'Development Approval approved or pending — we do not list pre-DA projects for capital raising.' },
                  { icon:'🏦', req:'Senior debt indicative', detail:'Evidence of senior lender interest strengthens your listing significantly.' },
                  { icon:'💳', req:'$299/month subscription', detail:'Activated after project approval. Paused if listing is withdrawn. No upfront listing fee.' },
                  { icon:'📊', req:'Quarterly investor updates', detail:'Once capital is raised — quarterly progress reports distributed to investors via the platform.' },
                ].map(item => (
                  <div key={item.req} style={{ display:'flex', gap:14, padding:'14px 0', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--ink)', marginBottom:3 }}>{item.req}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.65 }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SUBMISSION FORM */}
          <div id="dev-form" style={{ background:'var(--sage)', padding:'52px 56px' }}>
            <div style={{ maxWidth:800, margin:'0 auto' }}>
              {pDone ? (
                <div style={{ textAlign:'center', padding:'40px 0' }}>
                  <div style={{ fontSize:56, marginBottom:20 }}>🧬</div>
                  <div className="slbl" style={{ color:'rgba(201,168,76,0.6)' }}>Application Received</div>
                  <div className="stitle" style={{ color:'#fff', marginBottom:16 }}>We'll Be in Touch Within 48 Hours</div>
                  <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, maxWidth:400, margin:'0 auto', lineHeight:1.8 }}>Our team will review your project and contact you to discuss next steps including the FEASO builder and QS requirements.</p>
                </div>
              ) : (
                <div>
                  <div className="slbl" style={{ color:'rgba(201,168,76,0.6)', marginBottom:8 }}>Submit Your Project</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, color:'#fff', marginBottom:8 }}>Get Started in 5 Minutes</div>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:32, lineHeight:1.8 }}>Tell us about your project. We'll review within 48 hours and reach out to discuss the FEASO builder and capital raise structure.</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    {[['company','Entity / Company Name'],['name','Your Full Name'],['email','Email Address'],['phone','Phone Number']].map(([k,l]) => (
                      <div className="fg" key={k}>
                        <label className="fl" style={{ color:'rgba(245,242,236,0.4)' }}>{l}</label>
                        <input className="fi" value={pf[k]} onChange={e => setP(k, e.target.value)} placeholder={l} />
                      </div>
                    ))}
                    <div className="fg">
                      <label className="fl" style={{ color:'rgba(245,242,236,0.4)' }}>Site Address</label>
                      <input className="fi" value={pf.site||''} onChange={e => setP('site', e.target.value)} placeholder="Street, Suburb, State" />
                    </div>
                    <div className="fg">
                      <label className="fl" style={{ color:'rgba(245,242,236,0.4)' }}>DA Status</label>
                      <select className="fi" value={pf.da||''} onChange={e => setP('da', e.target.value)}>
                        <option value="">Select</option>
                        {['DA Approved','DA Pending','Pre-DA — concept only'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="fg">
                      <label className="fl" style={{ color:'rgba(245,242,236,0.4)' }}>Development Type</label>
                      <select className="fi" value={pf.type} onChange={e => setP('type', e.target.value)}>
                        <option value="">Select</option>
                        {['Residential Apartments','Townhouses','Land Subdivision','Mixed-Use','Adaptive Reuse','Commercial'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="fg">
                      <label className="fl" style={{ color:'rgba(245,242,236,0.4)' }}>Capital Raise Target</label>
                      <select className="fi" value={pf.raise} onChange={e => setP('raise', e.target.value)}>
                        <option value="">Select</option>
                        {['Under $1M','$1M–$3M','$3M–$5M','$5M–$10M','$10M+'].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop:8 }}>
                    <button className="btn btn-g" style={{ width:'100%', padding:'16px', fontSize:11, letterSpacing:'2px' }}
                      onClick={() => pf.company && pf.name && pf.email ? setPDone(true) : showT('Please fill in required fields')}>
                      Submit Project for Review →
                    </button>
                    <div className="snote" style={{ marginTop:12 }}>💳 Developer subscription ($299/month + GST) activated only after project review and approval. No upfront cost.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PARTNERS PAGE ── */}
      {page === 'partners' && (
        <div>
          {/* Hero */}
          <div style={{ background:'var(--ink)', minHeight:'44vh', display:'flex', alignItems:'flex-end', padding:'80px 56px 52px', position:'relative', overflow:'hidden' }}>
            <img src="https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1400&q=85&fit=crop&auto=format" loading="lazy" alt="Partners" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.15 }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.5) 100%)' }} />
            <div style={{ position:'relative', zIndex:2, maxWidth:680 }}>
              <div className="slbl" style={{ color:'rgba(201,168,76,0.6)', marginBottom:16 }}>Accountants · Financial Advisers · Mortgage Brokers · Buyers Agents</div>
              <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(32px,5vw,60px)', fontWeight:600, color:'#fff', lineHeight:1, marginBottom:20 }}>
                Your Clients Need This.<br /><em style={{ color:'var(--gold)' }}>You Make It Possible.</em>
              </h1>
              <p style={{ fontSize:14, color:'rgba(245,242,236,0.55)', maxWidth:520, lineHeight:1.85 }}>
                Prop Dev DNA gives professionals a compliant, credible way to connect their clients with Australia's highest-returning asset class — without carrying the regulatory burden yourself.
              </p>
            </div>
          </div>

          {/* Four audience cards */}
          <div style={{ background:'var(--paper)', padding:'64px 56px' }}>
            <div style={{ textAlign:'center', marginBottom:48 }}>
              <div className="slbl">Who This Is For</div>
              <div className="stitle">Four Ways to Partner</div>
              <p style={{ fontSize:14, color:'var(--muted)', maxWidth:520, margin:'0 auto', lineHeight:1.85 }}>Each profession has a different role. We have structured the platform to accommodate all of them — compliantly, with clear boundaries and real income potential.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:2, background:'rgba(0,0,0,0.07)' }}>
              {[
                {
                  icon:'📊',
                  color:'#C9A84C',
                  audience:'Accountants',
                  headline:'You Already Know Who Qualifies',
                  body:'You sign the s.761G certificates that grant wholesale investor access. Your clients are already asking you about alternatives to residential property and equities. Prop Dev DNA gives you a compliant, credible answer.',
                  howItWorks:[
                    'You introduce your client to the platform — verbally, as a reference, not a recommendation',
                    'Your client registers independently and uploads their s.761G certificate',
                    'We verify your membership number on the CPA Australia / CA ANZ / IPA public register',
                    'Your client gains Tier 2 access and can evaluate deals independently',
                    'You are not providing financial product advice — you are making a professional introduction',
                  ],
                  compliance:'Pure warm introduction model — no AFSL required. Your existing professional obligations are not affected. You are not recommending an investment — you are introducing a person to a regulated platform.',
                  income:'Where you hold no existing AFSL or AR appointment — you may be eligible for appointment as an Authorised Representative under AFSL 479499, which provides a documented income framework for introductions. Contact us to discuss.',
                  cta:'Enquire About Partnership',
                },
                {
                  icon:'💼',
                  audience:'Financial Advisers',
                  color:'#27AE60',
                  headline:'Your Wholesale Clients Are Already Asking',
                  body:'HNW clients with s.761G-qualifying assets are increasingly seeking development finance exposure — returns that outperform listed equities without the volatility. The problem has been finding a platform with the compliance standards that survive scrutiny.',
                  howItWorks:[
                    'You introduce your wholesale-eligible client to the platform — no product recommendation required',
                    'The platform handles all s.761G verification, risk acknowledgments, and compliance documentation',
                    'Your client evaluates and invests independently — you are not the advice provider',
                    'If you hold your own AFSL — the Category B warm introduction model applies: no fee, no recommendation, no compliance exposure',
                    'If you hold no existing AFSL — AR appointment under AFSL 479499 may be available',
                  ],
                  compliance:'We are conscious that licensed advisers who already hold an AFSL or AR appointment face dual authorisation constraints. The Category B model — pure warm introduction, no financial consideration, client-initiated — is designed for you. No compliance exposure. No AFSL conflict.',
                  income:'For advisers without existing AFSL obligations — we are exploring a structured referral income framework under AFSL 479499. For licensed advisers — the value is client service quality and access to a product that differentiates your practice.',
                  cta:'Register Your Interest',
                },
                {
                  icon:'🏠',
                  audience:'Mortgage Brokers',
                  color:'#4A90D9',
                  headline:'You Understand the Deal Table. So Do We.',
                  body:'Mortgage brokers are the natural referral partner for Prop Dev DNA. You understand credit, you have developer relationships, and you already sit at the intersection of capital and property. The platform is built by a licensed mortgage broker — the product language is yours.',
                  howItWorks:[
                    'Introduce developer clients to the platform for subordinated capital raising — complement your senior debt placement',
                    'Introduce wholesale investor clients to the investor network — earn referral income',
                    'Where you do not hold an AFSL — AR appointment under AFSL 479499 may be available',
                    'Where you do hold an ACL — your credit activities are unaffected; the referral sits separately',
                    'Broker commission on senior debt arranged through DFP continues as normal — we add the PDD layer alongside',
                  ],
                  compliance:'Mortgage brokers hold an ACL — not an AFSL. Referring clients to a wholesale investment platform is generally separate from your credit licence activities. Where an AR appointment is appropriate, the scope is clearly documented and ASIC-notified.',
                  income:'Referral income for investor introductions — where AR appointment is in place. Developer introductions to the platform — separate commercial arrangement. Senior debt broker commission through DFP on the same deal. Three potential income streams from one developer relationship.',
                  cta:'Register as a Partner Broker',
                },
                {
                  icon:'🔑',
                  audience:'Buyers Agents',
                  color:'#7ab88a',
                  headline:'VIP Presale Access for Your Investor Clients',
                  body:"Your investor clients want off-market, developer-priced stock before public launch. Prop Dev DNA's presale program gives Tier 2+ wholesale investors first access to off-the-plan units at developer pricing — 10–15% below projected market value at completion.",
                  howItWorks:[
                    'Your client registers on the platform as a wholesale investor — you assist with the process',
                    'Once Tier 2 verified — your client receives VIP presale alerts before any public marketing',
                    'Presale contracts executed through Prop Dev Realty at developer pricing',
                    'At completion — client settles (owns the unit) or assigns the contract (profit without settlement)',
                    'You earn your buyers advocacy fee directly from your client as normal — the platform is a source of stock, not a competitor',
                  ],
                  compliance:'Buyers agents are not providing financial product advice by introducing clients to a platform to evaluate investment opportunities. The platform handles all wholesale verification and compliance. Your buyers advocacy licence and the platform operate in separate regulatory frameworks.',
                  income:"Your standard buyers advocacy fee from your client. Where a buyers agent AR appointment is appropriate — referral income from Prop Dev DNA for introductions. Commission from Prop Dev Realty on presale contracts where you act as the buyer's representative.",
                  cta:'Register as a Buyers Agent Partner',
                },
              ].map(card => (
                <div key={card.audience} style={{ background:'#fff', borderTop:`4px solid ${card.color}`, padding:'36px 32px' }}>
                  <div style={{ fontSize:36, marginBottom:16 }}>{card.icon}</div>
                  <div style={{ fontSize:10, letterSpacing:'2.5px', textTransform:'uppercase', color:card.color, marginBottom:10 }}>{card.audience}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:600, color:'var(--ink)', marginBottom:14, lineHeight:1.2 }}>{card.headline}</div>
                  <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.85, marginBottom:24 }}>{card.body}</p>

                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:card.color, marginBottom:12 }}>How It Works</div>
                    {card.howItWorks.map((step,i) => (
                      <div key={i} style={{ display:'flex', gap:10, marginBottom:10 }}>
                        <span style={{ fontSize:9, letterSpacing:'1px', color:card.color, flexShrink:0, marginTop:3, fontWeight:600 }}>{String(i+1).padStart(2,'0')}</span>
                        <span style={{ fontSize:12, color:'var(--muted)', lineHeight:1.65 }}>{step}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background:'rgba(0,0,0,0.03)', border:'1px solid rgba(0,0,0,0.07)', padding:'16px', marginBottom:20 }}>
                    <div style={{ fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>Compliance Position</div>
                    <p style={{ fontSize:11, color:'var(--muted)', lineHeight:1.7 }}>{card.compliance}</p>
                  </div>

                  <div style={{ borderLeft:`3px solid ${card.color}`, paddingLeft:14, marginBottom:24 }}>
                    <div style={{ fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:card.color, marginBottom:6 }}>Income Potential</div>
                    <p style={{ fontSize:11, color:'var(--muted)', lineHeight:1.7 }}>{card.income}</p>
                  </div>

                  <button className="btn btn-g" style={{ width:'100%', justifyContent:'center' }}
                    onClick={() => setShowAuth(true)}>
                    {card.cta} →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* s.761G Certificate explainer for accountants */}
          <div style={{ background:'var(--ink)', padding:'52px 56px' }}>
            <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'start' }}>
              <div>
                <div className="slbl" style={{ color:'rgba(201,168,76,0.5)' }}>For Accountants</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, color:'#fff', marginBottom:16, lineHeight:1.1 }}>What the s.761G Certificate Means — and What It Doesn't</div>
                <p style={{ fontSize:13, color:'rgba(245,242,236,0.5)', lineHeight:1.85, marginBottom:20 }}>
                  Signing a s.761G wholesale investor certificate does not expose you to liability for your client's investment decisions. The certificate confirms your client meets a statutory eligibility threshold — it is not an endorsement of any investment.
                </p>
                <p style={{ fontSize:13, color:'rgba(245,242,236,0.5)', lineHeight:1.85, marginBottom:24 }}>
                  Prop Dev DNA verifies your membership number on the relevant professional body's public register before accepting any certificate. This protects you, your client, and the platform.
                </p>
                {[
                  ['The certificate confirms','Net assets of at least $2.5M (excluding principal residence) OR gross income of at least $250,000 p.a. for each of the last two financial years'],
                  ['The certificate does NOT confirm','That the investment is suitable. That the client can afford to lose the capital. That the investment will perform.'],
                  ['Your liability is limited to','The accuracy of the financial information you have reviewed. Standard professional obligations apply.'],
                  ['Certificate validity','2 years from the date of signing. The platform sends renewal reminders automatically.'],
                ].map(([label,text]) => (
                  <div key={label} style={{ padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize:11, fontWeight:500, color:'var(--gold)', marginBottom:5 }}>{label}</div>
                    <div style={{ fontSize:12, color:'rgba(245,242,236,0.4)', lineHeight:1.65 }}>{text}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="slbl" style={{ color:'rgba(201,168,76,0.5)', marginBottom:16 }}>Enquire About Partnership</div>
                <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(201,168,76,0.15)', padding:'32px' }}>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'#fff', marginBottom:8 }}>Register Your Interest</div>
                  <p style={{ fontSize:12, color:'rgba(245,242,236,0.35)', marginBottom:24, lineHeight:1.7 }}>Tell us your profession and how you'd like to engage. We'll be in touch within 2 business days with the right structure for your situation.</p>
                  {[['pname','Your Full Name'],['pemail','Email Address'],['pphone','Phone Number'],['pfirm','Firm / Practice Name']].map(([k,l]) => (
                    <div className="fg" key={k}>
                      <label className="fl" style={{ color:'rgba(245,242,236,0.3)' }}>{l}</label>
                      <input className="fi" placeholder={l} />
                    </div>
                  ))}
                  <div className="fg">
                    <label className="fl" style={{ color:'rgba(245,242,236,0.3)' }}>Your Profession</label>
                    <select className="fi">
                      <option value="">Select</option>
                      {['Accountant — CPA Australia','Accountant — CA ANZ','Accountant — IPA','Financial Adviser','Mortgage Broker','Buyers Agent','Other'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="fg">
                    <label className="fl" style={{ color:'rgba(245,242,236,0.3)' }}>How did you hear about Prop Dev DNA?</label>
                    <select className="fi">
                      <option value="">Select</option>
                      {['LinkedIn','Professional referral','Google Search','Industry event','Other'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-g" style={{ width:'100%', marginTop:8 }} onClick={() => showT('Thank you — we will be in touch within 2 business days with your unique referral link')}>
                    Register as Partner →
                  </button>
                  <div style={{ marginTop:12, padding:'12px 14px', background:'rgba(201,168,76,0.06)', border:'1px solid rgba(201,168,76,0.15)', fontSize:11, color:'rgba(245,242,236,0.5)', lineHeight:1.7 }}>
                    Once registered you will receive a unique referral link to share with clients. Your partner dashboard shows client registration status, deal progress, and — where applicable — income earned and pending.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DEVELOPER REGISTRY ── */}
      {page === 'developers' && (
        <div>
          <sec style={{ paddingTop: 80 }}>
            <div className="slbl">Accountability</div>
            <div className="stitle">Developer Track Record Registry</div>
            <p className="ssub" style={{ marginBottom: 32 }}>
              Every developer who has listed on Prop Dev DNA has a verified track record — public, searchable, and updated on every project completion. Australia's first standardised development finance track record registry.
            </p>
            <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', padding: '16px 20px', marginBottom: 32, fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
              <strong style={{ color: 'var(--ink)' }}>Why this exists:</strong> Banks have private blacklists. Brokers have network knowledge. Neither is public or standardised. Every investor on this platform deserves access to the same track record data that institutional lenders use to assess developers. This registry makes it public.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 40 }}>
              {[
                ['🌱', 'Emerging', 'First project on platform — no completed track record yet', '#888'],
                ['⭐', 'Established', '1–2 projects completed on platform — track record building', 'var(--gold)'],
                ['⭐⭐', 'Verified', '3+ projects completed — consistent delivery record', '#27AE60'],
                ['⭐⭐⭐', 'Elite', '5+ projects — outstanding track record on all metrics', '#C9A84C'],
              ].map(([icon, rating, desc, color]) => (
                <div key={rating} style={{ background: '#fff', padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: color, marginBottom: 6 }}>{rating}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Registry is updated automatically from completed project data. Developers cannot edit their own registry entries.
            </div>
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: '20px 24px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Sample Developer Pty Ltd</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Sydney NSW · Active since 2024 · 2 projects listed</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                    {[['Projects Completed', '1', ''], ['Avg. Timeline Variance', '+8%', '#E67E22'], ['Avg. Cost Variance', '+3%', '#27AE60'], ['Investor Return vs Forecast', '−2%', '#E67E22']].map(([label, val, color]) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: color || 'var(--ink)' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>⭐</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>Established</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>1 project completed</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.75 }}>
              <strong style={{ color: 'var(--ink)' }}>Note:</strong> The Developer Track Record Registry is populated from actual project outcomes on this platform only. Past performance is not a reliable indicator of future performance. This registry is provided as a transparency tool — not financial product advice or an endorsement of any developer.
            </div>
          </sec>
        </div>
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
              <div className="aphoto">👤</div>
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
            { plan: 'Developer', price: '$299', per: '/month + GST', f: ['Unlimited listings', 'FEASO builder + IM generator', 'Investor tier filtering', 'Proof of funds badge visibility', 'Investor lead tracking', '1.5% success fee on closes', 'Optional add-ons available'], cta: 'Start 7-Day Trial', feat: true },
            { plan: 'Success Fee', price: '1.5%', per: 'of capital raised', f: ['Only on completed closes', 'Equity, mezz & JV raises', 'Broker referral $500–$1,500', 'Invoiced within 7 days of settlement'], cta: 'Discuss Your Project' },
            { plan: 'Add-ons', price: '$149+', per: '/month, optional', f: ['Premium listing placement — $149–$299/month (featured spot)', 'IM white-label PDF export — $199 per IM (branded export)', 'No success fee if a deal doesn’t close'], cta: 'Discuss Your Project' },
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

      {/* ── COMPLIANCE PAGE ── */}
      {page === 'compliance' && (
        <sec style={{ paddingTop:80 }}>
          <div className="slbl">Regulatory Framework</div>
          <div className="stitle">Compliance Foundation</div>
          <p className="ssub" style={{ marginBottom:32 }}>
            Prop Dev DNA is built on a compliance framework that goes beyond what any competitor has implemented.
          </p>
          <div style={{ background:'var(--ink)', border:'1px solid rgba(201,168,76,0.12)', marginBottom:32 }}>
            {[
              { icon:'🛡', title:'AFSL 479499 — Regulatory Foundation', body:'Prop Dev DNA operates as a Corporate Authorised Representative of DFP Corporate Pty Ltd (AFSL 479499). This AFSL has been current since November 2015 and is audited by Hall Chadwick. All platform financial services operate under active ASIC oversight.' },
              { icon:'📋', title:'FEASO Builder — Viability Before Visibility', body:'Every development listing completes an independent feasibility assessment before any investor sees it. Below 15% margin on cost — blocked. 15–20% — admin review required. Above 20% — approved. Raises above $2M require independent QS sign-off on construction costs. Completed builds — past projects with actual returns achieved, builder scorecards, and timeline performance — will be publicly visible as social proof.' },
              { icon:'🔬', title:'Independent QS Certification', body:'For every capital raise above $2,000,000 — a registered AIQS Quantity Surveyor certifies construction cost inputs. Admin cross-checks every FEASO input against the QS report before a listing goes live.' },
              { icon:'✅', title:'Four-Tier Wholesale Investor Verification', body:"All investors must submit an s.761G accountant certificate from a CPA Australia, CA ANZ, or IPA member before accessing any deal information. Admin verifies the certifying accountant's membership before granting access." },
              { icon:'🔒', title:'Independent Trust — Funds Never Touch Prop Dev DNA', body:'Investor capital is never held by Prop Dev DNA. Each deal establishes an independent trust with an independent trustee. On minimum raise not met — all funds returned within 5 business days. On completion — waterfall distribution to investors before developer profit.' },
              { icon:'⏱', title:'Timestamped Risk Acknowledgment', body:'Every investor must complete a mandatory risk acknowledgment before any expression of interest can be submitted. Timestamped, IP-logged, stored per deal per investor. Records retained minimum 7 years.' },
              { icon:'👁', title:'Admin Approval Gate', body:'No listing goes live without internal admin review. FEASO reviewed, QS report cross-checked, IM reviewed for ASIC disclaimers. A human sees every deal before any investor does. Builder scorecard system and completed-build case studies will be publicly visible alongside every deal.' },
              { icon:'💼', title:'Full Conflict Disclosure — All Four Revenue Streams', body:'Platform success fee (1.5%), broker commission (0.55% + 0.15% trail), presale agency commission (2.5%), and Prop Dev Capital co-investment returns are all disclosed in the FSG and in every relevant Information Memorandum. No hidden revenue.' },
              { icon:'🏠', title:'Presale Agency Accountability — Prop Dev Realty', body:'Prop Dev Realty Pty Ltd operates under a separate NSW real estate licence (Property and Stock Agents Act 2002). VIP presale access is restricted to Tier 2+ verified wholesale investors. Presale deposits are held in solicitors’ trust accounts — not by any Prop Dev DNA Group entity.' },
            ].map((s,i) => (
              <div key={s.title} style={{ display:'flex', gap:20, borderBottom:'1px solid rgba(255,255,255,0.04)', padding:'24px 28px', background:i%2===0?'#0a0a0a':'#0d0d0d' }}>
                <div style={{ fontSize:28, flexShrink:0, marginTop:2 }}>{s.icon}</div>
                <div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:'#fff', fontWeight:600, marginBottom:10 }}>{s.title}</div>
                  <div style={{ fontSize:13, color:'rgba(245,242,236,0.55)', lineHeight:1.8 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'rgba(201,168,76,0.05)', border:'1px solid rgba(201,168,76,0.2)', padding:'28px 32px', marginBottom:32 }}>
            <div style={{ fontSize:10, letterSpacing:'3px', textTransform:'uppercase', color:'var(--gold)', marginBottom:10 }}>ASIC Innovation Hub</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'var(--ink)', marginBottom:12 }}>Proactive Regulatory Engagement</div>
            <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.8, marginBottom:0 }}>
              Prop Dev DNA has lodged a formal enquiry with the ASIC Innovation Hub covering the CAR structure under AFSL 479499, the per-deal trust model, wholesale investor verification, AML/CTF obligations, FSG requirements, and record retention. <strong style={{ color:'var(--ink)' }}>Status:</strong> Awaiting response — lodged June 2026.
            </p>
          </div>
          <div style={{ background:'var(--ink)', border:'1px solid rgba(201,168,76,0.12)', padding:'28px 32px', marginBottom:32 }}>
            <div style={{ fontSize:10, letterSpacing:'3px', textTransform:'uppercase', color:'var(--gold)', marginBottom:16 }}>Document Register</div>
            <div style={{ display:'grid', gap:0 }}>
              {[
                ['PDD-POL-001', 'Privacy Policy', 'Final — Legal Review'],
                ['PDD-POL-002', 'Terms of Service', 'Final — Legal Review'],
                ['PDD-FSG-001', 'Financial Services Guide', 'Final — AFSL Approval'],
                ['PDD-COM-001', 'Compliance Manual', 'Draft — AFSL Approval'],
                ['PDD-POL-003', 'Record Retention Policy', 'Final'],
                ['PDD-PROC-001', 'FEASO Review Procedure', 'Final'],
                ['PDD-PROC-002', 'Wholesale Cert Review Procedure', 'Final'],
                ['PDD-PROC-003', 'Breach Reporting Procedure', 'Final — AFSL Approval'],
              ].map(([ref, title, status], i) => (
                <div key={ref} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, padding:'14px 0', borderTop: i===0 ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display:'flex', gap:16, alignItems:'center', minWidth:0 }}>
                    <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--gold)', flexShrink:0 }}>{ref}</span>
                    <span style={{ fontSize:13, color:'#fff' }}>{title}</span>
                  </div>
                  <span style={{ fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(245,242,236,0.4)', flexShrink:0 }}>{status}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize:11, color:'var(--muted)', lineHeight:1.8, marginTop:16, marginBottom:0 }}>
              Full copies available on request from <span style={{ color:'var(--gold)' }}>anthony@financialdnagroup.com.au</span>.
            </p>
          </div>
          <div style={{ background:'var(--ink)', padding:'28px 32px' }}>
            <div style={{ fontSize:10, letterSpacing:'3px', textTransform:'uppercase', color:'var(--gold)', marginBottom:10 }}>Dispute Resolution</div>
            <p style={{ fontSize:13, color:'rgba(245,242,236,0.55)', lineHeight:1.8 }}>
              Complaints: <span style={{ color:'var(--gold)' }}>anthony@financialdnagroup.com.au</span> — acknowledged within 2 business days, responded within 10 business days. External: <strong style={{ color:'#fff' }}>AFCA</strong> — afca.org.au · 1800 931 678 · Membership 106939. Free and independent.
            </p>
          </div>
          <div style={{ marginTop:20, fontSize:11, color:'var(--muted)', lineHeight:1.8 }}>
            General information only — not financial product advice · Wholesale investors only · s.761G Corporations Act 2001 (Cth) · © 2026 Prop Dev DNA Pty Ltd
          </div>
        </sec>
      )}

      {/* ── FOOTER ── */}
      <footer>
        <div className="ftop">
          <div>
            <div className="flogo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo.png" alt="Prop Dev DNA" style={{ height: 36, width: 'auto', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
              <span>Prop Dev DNA</span>
            </div>
            <p className="ftag">Australia's professional wholesale property investment platform.</p>
            <p style={{ fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:'rgba(201,168,76,0.4)', marginTop:10, fontStyle:'italic' }}>Where Performance Meets Accountability</p>
          </div>
          <div>
            <div className="fch4">Platform</div>
            {[['listings','Opportunities'],['portal','For Developers'],['tiers','Investor Tiers'],['pricing','Pricing'],['compliance','Compliance']].map(([pg,l]) => <button key={l} className="fl2" onClick={() => go(pg)}>{l}</button>)}
          </div>
          <div>
            <div className="fch4">Company</div>
            {[['about','About'],['about','Contact']].map(([pg,l]) => <button key={l} className="fl2" onClick={() => go(pg)}>{l}</button>)}
          </div>
          <div>
            <div className="fch4">Entities</div>
            <p className="fl2" style={{cursor:'default'}}>Prop Dev DNA Pty Ltd</p>
            <p className="fl2" style={{cursor:'default'}}>Prop Dev Capital Pty Ltd</p>
            <p className="fl2" style={{cursor:'default'}}>Prop Dev Realty Pty Ltd</p>
            <p className="fl2" style={{cursor:'default'}}>Financial DNA Group Pty Ltd</p>
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
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <p className="fcopy">© 2026 Prop Dev DNA Pty Ltd</p>
            {!appInstalled && showInstall && (
              <button onClick={handleInstall} style={{ background:'none', border:'1px solid rgba(201,168,76,0.2)', color:'rgba(201,168,76,0.5)', fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', padding:'5px 12px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                ⬇ Add to Home Screen
              </button>
            )}
            {appInstalled && <span style={{ fontSize:9, color:'rgba(201,168,76,0.4)', letterSpacing:'1px', textTransform:'uppercase' }}>✓ App Installed</span>}
          </div>
        </div>
      </footer>

      {showAuth && <AuthModal defaultRole={authDefaultRole} onClose={() => { setShowAuth(false); setAuthDefaultRole(null); }} onLogin={u => { setUser(u); setAuthDefaultRole(null); showT(`Welcome, ${u.fname || u.email} 👋`); go(u.role === 'developer' || u.role === 'subcontractor' ? 'stages' : 'dashboard'); }} />}
      {showComp && <CompModal listing={sel} onAccept={() => { setShowComp(false); setShowEOI(true); }} onClose={() => setShowComp(false)} />}
      {showEOI && sel && <EOIModal listing={sel} onClose={() => setShowEOI(false)} toast={showT} user={user} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
