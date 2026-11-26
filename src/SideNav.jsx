// Left-hand navigation. Fixed sidebar on wide screens; slide-in drawer behind a menu button on narrow ones.
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { BOOKING_URL } from './shared.js';

const LINKS = [
  ['listings', 'Opportunities'], ['portal', 'Developers'], ['partners', 'Partners'], ['tiers', 'Investor Tiers'],
  ['pricing', 'Pricing'], ['compliance', 'Compliance'], ['developers', 'Track Record'], ['stages', 'Stage Scoring'], ['guides', 'Guides'], ['about', 'About']
];

export default function SideNav({ page, user, go, onSignIn, onSignOut, showInstall, onInstall }) {
  const [open, setOpen] = useState(false);
  const [marker, setMarker] = useState(null);
  const listRef = useRef(null);

  const account = user ? [
    ...(user.role === 'admin' ? [['admin', 'Admin']] : []),
    ...(user.role === 'regulator' || user.role === 'admin' ? [['regulator', 'Compliance View']] : []),
    ...(user.role === 'regulator' ? [] : [['dashboard', 'My Account']])
  ] : [];
  const current = page === 'detail' ? 'listings' : page;

  // The gold marker glides to whichever item is active.
  useLayoutEffect(() => {
    const el = listRef.current && listRef.current.querySelector('[aria-current="page"]');
    setMarker(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [current, user, open]);

  useEffect(() => { setOpen(false); }, [page]);
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const nav = pg => { setOpen(false); go(pg); };
  const item = ([pg, label], i) => (
    <button key={pg} className={`side-link ${current === pg ? 'on' : ''}`} aria-current={current === pg ? 'page' : undefined} style={{ '--i': i }} onClick={() => nav(pg)}>{label}</button>
  );
  const brand = (
    <button className="side-brand" onClick={() => nav('home')}>
      <img src="/logo.png" alt="" onError={e => { e.target.style.display = 'none'; }} />
      <span><strong>Prop Dev DNA</strong><em>Where Performance Meets Accountability</em></span>
    </button>
  );

  return (
    <>
      <div className="topbar">
        {brand}
        <button className={`menu-btn ${open ? 'x' : ''}`} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="side-menu" onClick={() => setOpen(o => !o)}>
          <i /><i /><i />
        </button>
      </div>
      <div className={`side-shade ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside id="side-menu" className={`side ${open ? 'open' : ''}`}>
        {brand}
        <nav className="side-nav" aria-label="Main" ref={listRef}>
          {marker && <span className="side-marker" style={{ transform: `translateY(${marker.top}px)`, height: marker.height }} />}
          {LINKS.map(item)}
          {account.length > 0 && <div className="side-sep">Account</div>}
          {account.map((a, i) => item(a, LINKS.length + i))}
        </nav>
        <div className="side-foot">
          <a className="side-cta" href={BOOKING_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Book a Meeting</a>
          {user
            ? <button className="side-cta ghost" onClick={() => { setOpen(false); onSignOut(); }}>Sign Out</button>
            : <button className="side-cta ghost" onClick={() => { setOpen(false); onSignIn(); }}>Sign In</button>}
          {showInstall && <button className="side-cta ghost" onClick={onInstall}>⬇ Install App</button>}
        </div>
      </aside>
    </>
  );
}
