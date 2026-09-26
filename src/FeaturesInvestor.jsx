// Investor-facing and public screens: EOI confirmation, my EOIs, waterfall, plain-English summary,
// FEASO / actuals / valuation read views, proof of funds, tradesman directory, buyers agents, developer registry.
import { useState, useEffect } from 'react';
import { API, lightFi, box, h3, money, dt, muted, TONES, STATUS_TONE } from './shared.js';

export function Pill({ status, children }) {
  const c = TONES[STATUS_TONE[status] || 'mute'];
  return <span style={{ fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: c, border: `1px solid ${c}`, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{children || String(status).replace(/_/g, ' ')}</span>;
}

const Page = ({ label, title, sub, children }) => (
  <sec style={{ paddingTop: 80 }}>
    {label && <div className="slbl">{label}</div>}
    <div className="stitle" style={{ marginBottom: 6 }}>{title}</div>
    {sub && <p className="ssub" style={{ margin: '0 0 24px', maxWidth: 720 }}>{sub}</p>}
    {children}
  </sec>
);

// ── 48-hour confirm / withdraw (emailed link) ──
export function EoiPage({ token, action }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!token) { setErr('This link is not valid.'); return; }
    API.get(`/api/eoi/${token}`).then(r => r.error ? setErr(r.error) : setD(r));
  }, [token]);
  const act = async a => {
    const r = await API.post(`/api/eoi/${token}`, { action: a });
    if (r.error) { setErr(r.error); return; }
    setResult(r.status);
  };
  if (err) return <Page title="Expression of interest"><div style={box}><p style={{ fontSize: 13 }}>{err}</p></div></Page>;
  if (!d) return <Page title="Expression of interest"><p className="ssub">Loading…</p></Page>;
  if (result) return <Page title={result === 'confirmed' ? 'Interest confirmed' : 'Interest withdrawn'}><div style={box}><div style={{ fontSize: 36 }}>{result === 'confirmed' ? '✅' : '↩️'}</div><p style={{ fontSize: 13, lineHeight: 1.8 }}>{result === 'confirmed' ? `Thank you. Your interest in ${d.listingName} has been passed to the developer. This is not a binding commitment to invest.` : `Your expression of interest in ${d.listingName} has been withdrawn. Nothing was sent to the developer.`}</p></div></Page>;
  const left = Math.max(0, Math.round((new Date(d.confirmBy) - Date.now()) / 3600000));
  return (
    <Page label="48-hour window" title={d.listingName} sub="Confirm or withdraw your expression of interest. It is not binding, and nothing goes to the developer until you confirm.">
      <div style={{ ...box, maxWidth: 640 }}>
        <div style={{ fontSize: 13, lineHeight: 1.9 }}>Reference <strong>{d.refCode}</strong> · Amount <strong>{d.amount || 'not stated'}</strong><br />Status <Pill status={d.status} />{d.status === 'pending_confirmation' && <span style={{ ...muted, marginLeft: 10 }}>about {left} hour{left === 1 ? '' : 's'} left</span>}</div>
        {d.status === 'pending_confirmation' ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button className={`btn ${action === 'withdraw' ? 'btn-o' : 'btn-g'}`} style={action === 'withdraw' ? { color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' } : {}} onClick={() => act('confirm')}>Confirm my interest</button>
            <button className={`btn ${action === 'withdraw' ? 'btn-g' : 'btn-o'}`} style={action === 'withdraw' ? {} : { color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' }} onClick={() => act('withdraw')}>Withdraw</button>
          </div>
        ) : <p style={{ ...muted, marginTop: 14 }}>This expression of interest is {d.status.replace(/_/g, ' ')}. No further action is needed.</p>}
        <p style={{ ...muted, marginTop: 16 }}>Capital is at risk. General information only, not financial product advice. Wholesale investors only.</p>
      </div>
    </Page>
  );
}

// ── Investor dashboard: my expressions of interest ──
export function MyEois({ showT }) {
  const [items, setItems] = useState(null);
  const load = () => API.get('/api/my/interests').then(r => setItems(Array.isArray(r) ? r : []));
  useEffect(() => { load(); }, []);
  const act = async (id, a) => {
    const r = await API.post(`/api/my/interests/${id}/${a}`, {});
    if (r.error) { showT(r.error); load(); return; }
    showT(a === 'confirm' ? 'Interest confirmed and passed to the developer.' : 'Interest withdrawn.');
    load();
  };
  if (!items || !items.length) return null;
  return (
    <div style={{ ...box, marginTop: 20 }}>
      <div style={h3}>My expressions of interest</div>
      {items.map(i => {
        const left = Math.max(0, Math.round((new Date(i.confirmBy) - Date.now()) / 3600000));
        return (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 13 }}><strong>{i.listingName}</strong> · {i.amount || '—'}<div style={muted}>Ref {i.refCode} · {dt(i.createdAt)}{i.status === 'pending_confirmation' ? ` · about ${left}h left to confirm` : ''}</div></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Pill status={i.status} />
              {i.status === 'pending_confirmation' && <>
                <button className="btn btn-g btn-sm" onClick={() => act(i.id, 'confirm')}>Confirm</button>
                <button className="btn btn-o btn-sm" style={{ color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' }} onClick={() => act(i.id, 'withdraw')}>Withdraw</button>
              </>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Waterfall scenarios ──
export function WaterfallPanel({ listingId }) {
  const [w, setW] = useState(null);
  const [k, setK] = useState('target');
  useEffect(() => { API.get(`/api/listings/${listingId}/waterfall`).then(setW); }, [listingId]);
  if (!w) return null;
  if (!w.available) return <div className="dsec" style={{ marginTop: 28 }}><h2>Waterfall Scenarios</h2><p>{w.reason}</p></div>;
  const s = w.scenarios.find(x => x.key === k);
  return (
    <div className="dsec" style={{ marginTop: 28 }}>
      <h2>Waterfall Scenarios</h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Who gets paid, in what order, if the project performs as forecast or not. Total development cost {money(w.tdc)} · investor raise {money(w.raise)} · {w.holdYears} year hold.</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {w.scenarios.map(x => <button key={x.key} className={`btn btn-sm ${x.key === k ? 'btn-g' : 'btn-o'}`} style={x.key === k ? {} : { color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.15)' }} onClick={() => setK(x.key)}>{x.label}</button>)}
      </div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>Sale revenue {money(s.revenue)} → after selling costs {money(s.netRevenue)}{s.overrunCost ? ` → less cost overrun ${money(s.overrunCost)}` : ''} = <strong>{money(s.distributable)}</strong> to distribute</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>{['In order', 'Owed', 'Paid', 'Shortfall'].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: h === 'In order' ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
          <tbody>
            {s.tiers.map(t => <tr key={t.key} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}><td style={{ padding: '8px' }}>{t.label}</td><td style={{ padding: '8px', textAlign: 'right' }}>{money(t.due)}</td><td style={{ padding: '8px', textAlign: 'right' }}>{money(t.paid)}</td><td style={{ padding: '8px', textAlign: 'right', color: t.shortfall > 0 ? '#C0392B' : 'inherit' }}>{t.shortfall > 0 ? money(t.shortfall) : '—'}</td></tr>)}
            <tr style={{ borderTop: '1px solid rgba(0,0,0,0.12)' }}><td style={{ padding: '8px' }}>Developer (remainder)</td><td /><td style={{ padding: '8px', textAlign: 'right' }}>{money(s.developer)}</td><td /></tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)', fontSize: 12, lineHeight: 1.8 }}>
        <strong>Investor outcome in this scenario:</strong> {s.investorPrincipalRecoveredPct != null ? `${s.investorPrincipalRecoveredPct}% of principal recovered` : '—'} · total paid to investors {money(s.investorPaid)}{s.investorAnnualisedPct != null ? ` · about ${s.investorAnnualisedPct}% a year` : ''}.
      </div>
      <ul style={{ margin: '12px 0 0 18px', fontSize: 10, color: 'var(--muted)', lineHeight: 1.7 }}>{w.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </div>
  );
}

// ── Plain-English summary ──
export function SummaryPanel({ listingId }) {
  const [s, setS] = useState(null);
  useEffect(() => { API.get(`/api/listings/${listingId}/summary`).then(setS); }, [listingId]);
  if (!s || !s.answers) return null;
  return (
    <div className="dsec" style={{ marginTop: 28 }}>
      <h2>Plain-English Summary</h2>
      {s.answers.map(a => <div key={a.q} style={{ marginBottom: 12 }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{a.q}</div><p style={{ margin: 0 }}>{a.a}</p></div>)}
    </div>
  );
}

// ── Step shown before the risk acknowledgment: read the summary and the waterfall ──
export function SummaryModal({ listing, onDone, onClose }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ background: '#fff', color: '#111', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="mlbl">Before you continue</div>
        <h2 style={{ color: '#111' }}>{listing.name || listing.title}</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Read this plain-English summary and look at what could happen to your money in each scenario. This is required before you can express interest.</p>
        <SummaryPanel listingId={listing.id} />
        <WaterfallPanel listingId={listing.id} />
        <label style={{ display: 'flex', gap: 10, fontSize: 13, margin: '20px 0 12px', lineHeight: 1.6, color: '#111' }}>
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />
          <span>I have read the summary and reviewed the waterfall scenarios, including the downside cases.</span>
        </label>
        <div className="matns">
          <button className="btn btn-g" style={{ flex: 1, opacity: ok ? 1 : 0.4 }} disabled={!ok} onClick={onDone}>Continue →</button>
          <button className="btn btn-o" style={{ color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Investor read view of the locked FEASO (wholesale-verified only) ──
export function FeasoReadPanel({ listing, user, go }) {
  const [d, setD] = useState(null);
  const [gate, setGate] = useState(null);
  useEffect(() => {
    if (!user) return;
    API.get(`/api/listings/${listing.id}/feaso`).then(r => { if (r.code === 'tier_required') setGate(r.error); else if (!r.error) setD(r); });
  }, [listing.id, user]);
  const F = { landPrice: 'Land price', landCosts: 'Land costs (stamp duty, legals)', siteworks: 'Siteworks and demolition', constructionCost: 'Construction cost', contingency: 'Contingency', professionalFees: 'Professional fees', councilFees: 'Council and authority fees', financeCosts: 'Finance costs', marketing: 'Marketing', holdingCosts: 'Holding costs' };
  return (
    <div className="dsec" style={{ marginTop: 28 }}>
      <h2>Feasibility (FEASO)</h2>
      {!user && <p>Sign in and complete wholesale verification to see the feasibility detail.</p>}
      {user && gate && <p>{gate} <button className="nl" style={{ display: 'inline', color: 'var(--gold)' }} onClick={() => go('dashboard')}>Verify now →</button></p>}
      {user && d && d.feaso && d.feaso.status === 'locked' && (() => {
        const f = d.feaso, c = f.computed, i = f.inputs;
        return <>
          <p style={{ fontSize: 12 }}>Locked version {f.version} on {dt(f.lockedAt)}. Margin on cost <strong>{c.marginOnCost}%</strong> (platform minimum {d.rules.minMargin}%){f.qs ? ' · QS certificate on file' : ''}.</p>
          <div style={{ fontSize: 12 }}>
            {Object.entries(F).map(([k, l]) => { const v = k === 'contingency' ? c.contingency : i[k]; return <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}><span style={{ color: 'var(--muted)' }}>{l}</span><span>{money(v)}</span></div>; })}
            {[['Total development cost', c.tdc], ['Gross realisable value', i.grv], ['Selling costs', c.sellingCosts], ['Profit', c.profit]].map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 600 }}><span>{l}</span><span>{money(v)}</span></div>)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, wordBreak: 'break-all' }}>Integrity hash {f.hash}. Inputs cannot be changed after lock; earlier versions are retained.</div>
        </>;
      })()}
      {user && d && !(d.feaso && d.feaso.status === 'locked') && d.financials && <>
        <p style={{ fontSize: 12 }}>The developer's financial summary (not yet a locked FEASO):</p>
        {d.financials.map(r => <div key={r[0]} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 12 }}><span style={{ color: 'var(--muted)' }}>{r[0]}</span><span>{r[1]}</span></div>)}
      </>}
    </div>
  );
}

// ── Actuals vs forecast (real reports only; no placeholders) ──
export function ActualsPanel({ listing, user }) {
  const a = listing.actualsLatest;
  const [hist, setHist] = useState(null);
  const loadHist = () => API.get(`/api/listings/${listing.id}/actuals`).then(r => setHist(r.error ? [] : r.entries));
  const rows = a ? [
    ['Construction cost', money(a.forecast.constructionCost), a.actualConstructionCost != null ? money(a.actualConstructionCost) : '—', a.variance.costPct],
    ['Revenue', money(a.forecast.revenue), a.actualRevenue != null ? money(a.actualRevenue) : '—', a.variance.revenuePct],
    ['Margin on cost', a.forecast.marginOnCost != null ? a.forecast.marginOnCost + '%' : '—', a.actualMargin != null ? a.actualMargin + '%' : '—', a.variance.marginPct],
    ['Completion', a.forecast.completion ? dt(a.forecast.completion) : '—', a.actualCompletion ? dt(a.actualCompletion) : '—', a.variance.timeDays != null ? null : undefined, a.variance.timeDays]
  ] : [];
  return (
    <div style={{ marginTop: 24, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 20 }}>
      <div style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>FEASO — Actuals vs Forecast</div>
      {!a && <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>No actuals have been reported yet. When the developer records QS-referenced actuals, they appear here with the variance from forecast, and investors are alerted at 10% or more.</div>}
      {a && <>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{a.milestone} · {dt(a.at)} · QS ref {a.qsRef}</div>
        {rows.map(([label, fc, act, pct, days]) => {
          const v = pct != null ? pct : (days != null ? days : null);
          const bad = pct != null ? Math.abs(pct) >= 10 : false;
          return <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 11 }}>
            <span style={{ flex: 1, color: 'var(--muted)' }}>{label}</span><span style={{ flex: 1, textAlign: 'center' }}>Forecast {fc}</span><span style={{ flex: 1, textAlign: 'center', fontWeight: 500 }}>Actual {act}</span>
            <span style={{ width: 62, textAlign: 'right', fontWeight: 600, color: bad ? '#C0392B' : '#27AE60' }}>{v == null ? '' : (pct != null ? `${pct > 0 ? '+' : ''}${pct}%` : `${days > 0 ? '+' : ''}${days}d`)}</span>
          </div>;
        })}
        {a.alert && <div style={{ marginTop: 8, fontSize: 11, color: '#C0392B' }}>⚠ Variance alert: {a.reasons.join('; ')}</div>}
        {user && !hist && <button className="nl" style={{ color: 'var(--gold)', marginTop: 10 }} onClick={loadHist}>View reporting history →</button>}
        {hist && hist.map(e => <div key={e.id} style={{ fontSize: 10, color: 'var(--muted)', padding: '4px 0' }}>{dt(e.at)} · {e.milestone} · QS {e.qsRef}{e.alert ? ' · ALERT' : ''}</div>)}
      </>}
      {listing.valuationRequired && <div style={{ marginTop: 14, fontSize: 11, lineHeight: 1.7 }}>
        <strong>Completion valuation:</strong> {listing.valuation ? `approved. ${listing.valuation.valuerName} (${listing.valuation.valuerRegistration}) valued the project at ${money(listing.valuation.valueAmount)} on ${dt(listing.valuation.valuationDate)}.` : `required (deal above $5M GRV), ${listing.valuationStatus === 'submitted' ? 'submitted and awaiting approval' : 'not yet submitted'}. Distributions are gated on an approved valuation.`}
      </div>}
    </div>
  );
}

// ── Proof of funds (Tier 3) ──
export function FundsStep({ user, showT, onUser }) {
  const [st, setSt] = useState(null);
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('');
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const load = () => API.get('/api/proof-of-funds/status').then(r => { if (!r.error) setSt(r); });
  useEffect(() => { load(); API.get('/api/proof-of-funds/types').then(r => { setTypes(r.types || []); setType((r.types || [])[0] || ''); }); }, []);
  if (!st) return null;
  const submit = async () => {
    setErr('');
    if (!file) { setErr('Attach your statement or letter.'); return; }
    const fd = new FormData(); fd.append('proofType', type); fd.append('fundsFile', file);
    const r = await API.upload('/api/proof-of-funds', fd);
    if (r.error) { setErr(r.error); return; }
    showT('Proof of funds submitted for review.'); setFile(null); load(); onUser && onUser();
  };
  return (
    <div style={{ fontSize: 12, lineHeight: 1.8 }}>
      {st.fundsStatus === 'verified' && <div>Verified{st.fundsExpiresAt ? ` until ${dt(st.fundsExpiresAt)}` : ''}. {st.endorsed ? 'You are PDD Endorsed (Tier 4).' : 'Tier 3 — Capital Ready.'}</div>}
      {st.fundsStatus === 'pending' && <div>Submitted and awaiting review.</div>}
      {(st.fundsStatus === 'none' || st.fundsStatus === 'rejected') && (user.tier === 'registered'
        ? <div style={muted}>Complete wholesale verification first.</div>
        : <div>
          {st.fundsStatus === 'rejected' && <div style={{ color: '#C0392B', marginBottom: 6 }}>Your last document was not accepted{st.proof && st.proof.adminNotes ? `: ${st.proof.adminNotes}` : '.'}</div>}
          <select className="fi" style={{ ...lightFi, marginBottom: 8 }} value={type} onChange={e => setType(e.target.value)}>{types.map(t => <option key={t}>{t}</option>)}</select>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0] || null)} />
          {err && <div style={{ color: '#C0392B', marginTop: 6 }}>{err}</div>}
          <div><button className="btn btn-g btn-sm" style={{ marginTop: 10 }} onClick={submit}>Submit for review →</button></div>
        </div>)}
    </div>
  );
}

// ── Public: verified tradespeople directory ──
export function TradesmenPage({ user, openAuth }) {
  const [meta, setMeta] = useState({ trades: [], states: [] });
  const [q, setQ] = useState({ trade: '', state: '' });
  const [data, setData] = useState(null);
  const [contact, setContact] = useState({});
  useEffect(() => { API.get('/api/tradesmen/meta').then(setMeta); }, []);
  useEffect(() => {
    const p = new URLSearchParams(); if (q.trade) p.set('trade', q.trade); if (q.state) p.set('state', q.state);
    API.get('/api/tradesmen?' + p.toString()).then(setData);
  }, [q]);
  const showContact = async id => { const r = await API.get(`/api/tradesmen/${id}/contact`); setContact(c => ({ ...c, [id]: r })); };
  return (
    <sec style={{ paddingTop: 80 }}>
      <div className="slbl">Tradespeople</div>
      <div className="stitle" style={{ marginBottom: 6 }}>Verified Tradesperson Directory</div>
      <p className="ssub" style={{ margin: '0 0 8px', maxWidth: 720 }}>Tradespeople listed here have had their licence and insurance checked by Prop Dev DNA, and carry a score built from builders' stage-by-stage ratings on real projects.</p>
      <div style={{ display: 'flex', gap: 10, margin: '16px 0 24px', flexWrap: 'wrap' }}>
        <button className="btn btn-g btn-sm" onClick={() => openAuth('subcontractor')}>I'm a tradesperson — register →</button>
        <select className="fi" style={{ ...lightFi, width: 'auto' }} value={q.trade} onChange={e => setQ(s => ({ ...s, trade: e.target.value }))}><option value="">All trades</option>{meta.trades.map(t => <option key={t}>{t}</option>)}</select>
        <select className="fi" style={{ ...lightFi, width: 'auto' }} value={q.state} onChange={e => setQ(s => ({ ...s, state: e.target.value }))}><option value="">All states</option>{meta.states.map(t => <option key={t}>{t}</option>)}</select>
      </div>
      {!data && <p className="ssub">Loading…</p>}
      {data && data.items.length === 0 && <div style={box}><p style={{ fontSize: 13 }}>No verified tradespeople match yet. Tradespeople appear here once an administrator has verified their licence and insurance.</p></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {data && data.items.map(t => (
          <div key={t.id} style={{ ...box, marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19 }}>{t.businessName}</div>{t.demo && <Pill status="warn">Demo</Pill>}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{t.trade} · {t.state}{t.licenceClass ? ` · ${t.licenceClass}` : ''}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}><Pill status="verified">Licence verified</Pill><Pill status="verified">Insurance verified</Pill></div>
            <div style={{ fontSize: 12 }}>{t.avgScore != null ? <><strong style={{ color: 'var(--gold)', fontSize: 18 }}>{t.avgScore}/5</strong> across {t.scoredCount} scored stage{t.scoredCount === 1 ? '' : 's'}</> : <span style={muted}>Not yet scored on a project</span>}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Licence to {dt(t.licenceExpiry)} · insurance to {dt(t.insuranceExpiry)}</div>
            {user && ['developer', 'admin'].includes(user.role) && (contact[t.id] && !contact[t.id].error
              ? <div style={{ fontSize: 12, marginTop: 10 }}>{contact[t.id].contactName}<br />{contact[t.id].email}{contact[t.id].phone ? <><br />{contact[t.id].phone}</> : null}</div>
              : <button className="btn btn-d btn-sm" style={{ marginTop: 10 }} onClick={() => showContact(t.id)}>Show contact</button>)}
          </div>
        ))}
      </div>
      {data && <p style={{ ...muted, marginTop: 20, maxWidth: 720 }}>{data.note} Not a recommendation. Always confirm current licence and insurance before engaging a contractor.</p>}
    </sec>
  );
}

// ── Public: buyers agent directory ──
export function BuyersAgentsPage({ go }) {
  const [d, setD] = useState(null);
  useEffect(() => { API.get('/api/directory/buyers-agents').then(setD); }, []);
  return (
    <Page label="Introducing professionals" title="Buyers Agent Directory" sub="Independent buyers agents who introduce clients to platform presale and development stock.">
      {!d && <p className="ssub">Loading…</p>}
      {d && d.items.length === 0 && <div style={box}><p style={{ fontSize: 13 }}>No buyers agents are listed yet. Buyers agents can apply through the partner enquiry on our Partners page.</p><button className="btn btn-d btn-sm" onClick={() => go('partners')}>Partner with us →</button></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {d && d.items.map((a, i) => <div key={i} style={{ ...box, marginBottom: 0 }}><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19 }}>{a.name}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.firm}</div>{a.licenceNumber && <div style={{ fontSize: 11, marginTop: 6 }}>Licence {a.licenceNumber}</div>}</div>)}
      </div>
      {d && <p style={{ ...muted, marginTop: 20, maxWidth: 720 }}>{d.disclosure}</p>}
    </Page>
  );
}

// ── Public: developer track record registry (computed, not self-reported) ──
export function RegistryPage() {
  const [d, setD] = useState(null);
  useEffect(() => { API.get('/api/registry/developers').then(setD); }, []);
  const v = (x, suf = '') => x == null ? '—' : `${x > 0 && suf === '%' ? '+' : ''}${x}${suf}`;
  return (
    <Page label="Track record" title="Developer Track Record Registry" sub="Built automatically from platform activity. Developers cannot edit these figures.">
      {!d && <p className="ssub">Loading…</p>}
      {d && d.items.length === 0 && <div style={box}><p style={{ fontSize: 13 }}>No developer has enough platform activity to show yet. Entries appear as developers list projects, report QS-referenced actuals and score their contractors.</p></div>}
      {d && d.items.map((x, i) => (
        <div key={i} style={box}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, marginBottom: 10 }}>{x.name}</div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            {[['Projects listed', x.projectsListed], ['Completed', x.projectsCompleted], ['Actuals reports', x.actualsReports], ['Avg cost variance', v(x.avgCostVariancePct, '%')], ['Avg margin variance', x.avgMarginVariancePoints == null ? '—' : x.avgMarginVariancePoints + ' pts'], ['Avg completion variance', x.avgCompletionVarianceDays == null ? '—' : x.avgCompletionVarianceDays + ' days'], ['Contractor stages scored', `${x.stagesScored}/${x.stagesTotal}`], ['Avg contractor score', x.avgContractorScore == null ? '—' : x.avgContractorScore + '/5'], ['Milestone certificates', x.milestoneCertificates]].map(([l, val]) => <div key={l} style={{ minWidth: 110 }}><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: 'var(--gold)', lineHeight: 1 }}>{val}</div><div style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>{l}</div></div>)}
          </div>
        </div>
      ))}
      {d && <p style={{ ...muted, maxWidth: 720 }}>{d.note}</p>}
    </Page>
  );
}
