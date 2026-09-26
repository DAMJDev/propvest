// Developer workspace (FEASO builder, actuals, valuation, capital certainty, drawdowns, review submission),
// subcontractor compliance profile, and the admin console for the new controls.
import { useState, useEffect, useCallback } from 'react';
import { API, lightFi, box, h3, money, dt, muted } from './shared.js';
import { Pill } from './FeaturesInvestor.jsx';

const Input = ({ label, ...p }) => (
  <div>{label && <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>{label}</label>}<input className="fi" style={lightFi} {...p} /></div>
);
const Grid = ({ children, min = 190 }) => <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 }}>{children}</div>;
const Err = ({ e }) => e ? <div style={{ color: '#C0392B', fontSize: 12, marginTop: 8 }}>{e}</div> : null;

// ── New project ──
export function NewProjectForm({ showT, onCreated, onCancel }) {
  const [f, setF] = useState({ name: '', loc: '', type: 'residential', category: '', structure: 'Preferred Equity', hold: '', raise: '', minInvest: '', overview: '', trusteeEmail: '' });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    setErr('');
    const r = await API.post('/api/listings', { ...f, loc: f.loc ? `📍 ${f.loc}` : '' });
    if (r.error) { setErr(r.error); return; }
    showT('Project created as a draft.'); onCreated(r.listing);
  };
  return (
    <div style={box}>
      <div style={h3}>New project</div>
      <Grid>
        <Input label="Project name" value={f.name} onChange={e => set('name', e.target.value)} />
        <Input label="Location (suburb, state)" placeholder="Parramatta, NSW" value={f.loc} onChange={e => set('loc', e.target.value)} />
        <div><label style={{ fontSize: 10, color: 'var(--muted)' }}>Type</label><select className="fi" style={lightFi} value={f.type} onChange={e => set('type', e.target.value)}>{['residential', 'commercial', 'mixed'].map(t => <option key={t}>{t}</option>)}</select></div>
        <Input label="Category" placeholder="e.g. Residential — Townhouses" value={f.category} onChange={e => set('category', e.target.value)} />
        <div><label style={{ fontSize: 10, color: 'var(--muted)' }}>Structure</label><select className="fi" style={lightFi} value={f.structure} onChange={e => set('structure', e.target.value)}>{['Preferred Equity', 'Equity / Joint Venture', 'Mezzanine'].map(t => <option key={t}>{t}</option>)}</select></div>
        <Input label="Hold period" placeholder="3 yr" value={f.hold} onChange={e => set('hold', e.target.value)} />
        <Input label="Raise target" placeholder="$5,000,000" value={f.raise} onChange={e => set('raise', e.target.value)} />
        <Input label="Minimum investment" placeholder="$100,000" value={f.minInvest} onChange={e => set('minInvest', e.target.value)} />
        <Input label="Trustee email (for variance alerts, optional)" type="email" value={f.trusteeEmail} onChange={e => set('trusteeEmail', e.target.value)} />
      </Grid>
      <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', margin: '10px 0 3px' }}>Overview</label>
      <textarea className="fi" style={{ ...lightFi, minHeight: 70 }} value={f.overview} onChange={e => set('overview', e.target.value)} />
      <Err e={err} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="btn btn-g btn-sm" onClick={save}>Create draft</button><button className="btn btn-o btn-sm" style={{ color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' }} onClick={onCancel}>Cancel</button></div>
      <p style={{ ...muted, marginTop: 10 }}>A draft is not visible to investors. Next: build and lock your FEASO, then submit for review.</p>
    </div>
  );
}

// ── FEASO builder ──
const GROUPS = [
  ['1 · Site', [['landPrice', 'Land price'], ['landCosts', 'Land costs (stamp duty, legals)'], ['siteworks', 'Siteworks and demolition']]],
  ['2 · Construction', [['constructionCost', 'Construction cost'], ['contingencyPct', 'Contingency (% of construction)']]],
  ['3 · Fees', [['professionalFees', 'Professional fees'], ['councilFees', 'Council and authority fees']]],
  ['4 · Finance', [['financeCosts', 'Finance costs (interest and fees)']]],
  ['5 · Sales', [['grv', 'Gross realisable value'], ['sellingCostsPct', 'Selling costs (% of GRV)'], ['units', 'Number of units'], ['marketing', 'Marketing']]],
  ['6 · Holding', [['holdingCosts', 'Holding costs (rates, insurance)'], ['holdMonths', 'Hold period (months)']]]
];
const N = v => { const n = Number(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
function calc(i) {
  const v = k => N(i[k]);
  const contingency = v('constructionCost') * v('contingencyPct') / 100;
  const tdc = v('landPrice') + v('landCosts') + v('siteworks') + v('constructionCost') + contingency + v('professionalFees') + v('councilFees') + v('financeCosts') + v('marketing') + v('holdingCosts');
  const selling = v('grv') * v('sellingCostsPct') / 100;
  const profit = v('grv') - selling - tdc;
  return { tdc, selling, profit, margin: tdc > 0 ? profit / tdc * 100 : 0 };
}

export function FeasoBuilder({ listing, showT, onChanged }) {
  const [st, setSt] = useState(null);
  const [rules, setRules] = useState({ minMargin: 15, qsThreshold: 2000000 });
  const [inputs, setInputs] = useState({});
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => API.get(`/api/listings/${listing.id}/feaso`).then(r => {
    if (r.error) return;
    setSt(r.feaso); if (r.rules) setRules(r.rules);
    if (r.feaso && r.feaso.inputs) setInputs(Object.fromEntries(Object.entries(r.feaso.inputs).map(([k, v]) => [k, String(v)])));
  }), [listing.id]);
  useEffect(() => { load(); }, [load]);
  const locked = st && st.status === 'locked';
  const c = calc(inputs);
  const passes = c.margin >= rules.minMargin;
  const qsNeeded = c.tdc > rules.qsThreshold;
  const body = () => Object.fromEntries(GROUPS.flatMap(g => g[1]).map(([k]) => [k, N(inputs[k])]));

  const save = async () => { setErr(''); const r = await API.put(`/api/listings/${listing.id}/feaso/draft`, body()); if (r.error) { setErr(r.error); return false; } setSt(r.feaso); showT('Draft saved.'); return true; };
  const uploadQs = async () => {
    setErr(''); if (!file) { setErr('Choose the QS certificate first.'); return; }
    if (!(await save())) return;
    const fd = new FormData(); fd.append('qsFile', file);
    const r = await API.upload(`/api/listings/${listing.id}/feaso/qs`, fd);
    if (r.error) { setErr(r.error); return; }
    showT('QS certificate uploaded.'); setFile(null); load();
  };
  const submit = async () => {
    setErr(''); if (!(await save())) return;
    const r = await API.post(`/api/listings/${listing.id}/feaso/submit`, {});
    if (r.error) { setErr(r.error); load(); return; }
    showT('FEASO submitted and locked.'); setSt(r.feaso); onChanged && onChanged();
  };

  return (
    <div>
      <p style={{ ...muted, marginBottom: 12 }}>All figures are calculated by the platform. Margin on cost must be at least {rules.minMargin}%. A QS certificate is required above {money(rules.qsThreshold)} total cost. Once submitted, inputs are locked and versioned.</p>
      {locked && <div style={{ padding: '10px 14px', background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.3)', fontSize: 12, marginBottom: 12 }}>🔒 Locked — version {st.version}, {dt(st.lockedAt)}. Inputs cannot be changed. To amend, ask the platform to reopen it (recorded in the audit trail).</div>}
      {GROUPS.map(([title, fields]) => (
        <div key={title} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>{title}</div>
          <Grid min={170}>{fields.map(([k, l]) => <Input key={k} label={l} inputMode="decimal" disabled={locked} value={inputs[k] ?? ''} onChange={e => setInputs(p => ({ ...p, [k]: e.target.value }))} />)}</Grid>
        </div>
      ))}
      <div style={{ ...box, marginBottom: 12, background: passes ? 'rgba(39,174,96,0.05)' : 'rgba(192,57,43,0.05)' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
          <div>Total development cost <strong>{money(c.tdc)}</strong></div><div>Profit <strong>{money(c.profit)}</strong></div>
          <div>Margin on cost <strong style={{ color: passes ? '#27ae60' : '#C0392B' }}>{c.margin.toFixed(1)}%</strong> {passes ? '✓ meets minimum' : `✗ below the ${rules.minMargin}% minimum — cannot be submitted`}</div>
        </div>
        {qsNeeded && <div style={{ fontSize: 12, marginTop: 8 }}>QS certificate required. {st && st.qs ? `On file: ${st.qs.fileName}` : 'None uploaded yet.'}</div>}
      </div>
      {!locked && <>
        {qsNeeded && <div style={{ marginBottom: 10 }}><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0] || null)} /> <button className="btn btn-d btn-sm" onClick={uploadQs}>Upload QS certificate</button></div>}
        <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-o btn-sm" style={{ color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' }} onClick={save}>Save draft</button><button className="btn btn-g btn-sm" onClick={submit}>Submit and lock →</button></div>
      </>}
      <Err e={err} />
      {st && st.versions && st.versions.length > 0 && <div style={{ ...muted, marginTop: 14 }}>Versions: {st.versions.map(v => `v${v.version} (${dt(v.submittedAt)}, margin ${v.computed.marginOnCost}%)`).join(' · ')}</div>}
    </div>
  );
}

// ── Actuals ──
export function ActualsForm({ listing, showT, onChanged }) {
  const [f, setF] = useState({ milestone: '', actualConstructionCost: '', actualTotalCost: '', actualRevenue: '', actualCompletion: '', qsRef: '', notes: '' });
  const [file, setFile] = useState(null);
  const [hist, setHist] = useState([]);
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const load = () => API.get(`/api/listings/${listing.id}/actuals`).then(r => setHist(r.entries || []));
  useEffect(() => { load(); }, [listing.id]);
  const submit = async () => {
    setErr('');
    const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append('qsFile', file);
    const r = await API.upload(`/api/listings/${listing.id}/actuals`, fd);
    if (r.error) { setErr(r.error); return; }
    showT(r.entry.alert ? `Recorded. Variance alert sent (${r.entry.reasons.join('; ')}).` : 'Actuals recorded.');
    setF({ milestone: '', actualConstructionCost: '', actualTotalCost: '', actualRevenue: '', actualCompletion: '', qsRef: '', notes: '' }); setFile(null); load(); onChanged && onChanged();
  };
  if (listing.status !== 'active') return <p style={muted}>Actuals can be recorded once the listing is live.</p>;
  return (
    <div>
      <p style={{ ...muted, marginBottom: 10 }}>Record figures from your QS progress report. Each entry is compared with the forecast; a variance of 10% or more alerts confirmed investors, the platform and the trustee.</p>
      <Grid>
        <Input label="Milestone / period" value={f.milestone} onChange={e => set('milestone', e.target.value)} />
        <Input label="QS report reference" value={f.qsRef} onChange={e => set('qsRef', e.target.value)} />
        <Input label="Actual construction cost" inputMode="decimal" value={f.actualConstructionCost} onChange={e => set('actualConstructionCost', e.target.value)} />
        <Input label="Actual total cost (for margin)" inputMode="decimal" value={f.actualTotalCost} onChange={e => set('actualTotalCost', e.target.value)} />
        <Input label="Actual / contracted revenue" inputMode="decimal" value={f.actualRevenue} onChange={e => set('actualRevenue', e.target.value)} />
        <Input label="Actual or expected completion" type="date" value={f.actualCompletion} onChange={e => set('actualCompletion', e.target.value)} />
      </Grid>
      <textarea className="fi" style={{ ...lightFi, minHeight: 50, marginTop: 10 }} placeholder="Notes (optional)" value={f.notes} onChange={e => set('notes', e.target.value)} />
      <div style={{ marginTop: 8 }}><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0] || null)} /> <span style={muted}>QS report (optional)</span></div>
      <Err e={err} />
      <button className="btn btn-g btn-sm" style={{ marginTop: 12 }} onClick={submit}>Record actuals</button>
      {hist.map(e => <div key={e.id} style={{ fontSize: 12, padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 8 }}><strong>{e.milestone}</strong> · {dt(e.at)} · QS {e.qsRef} {e.alert && <Pill status="blocked">Alert</Pill>}<div style={muted}>{e.reasons.length ? e.reasons.join('; ') : 'Within 10% of forecast.'}</div></div>)}
    </div>
  );
}

// ── Valuation ──
export function ValuationForm({ listing, showT, onChanged }) {
  const [v, setV] = useState(null);
  const [f, setF] = useState({ valuerName: '', valuerRegistration: '', valuationDate: '', valueAmount: '' });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const load = () => API.get(`/api/listings/${listing.id}/valuation`).then(setV);
  useEffect(() => { load(); }, [listing.id]);
  const submit = async () => {
    setErr('');
    const fd = new FormData(); Object.entries(f).forEach(([k, val]) => fd.append(k, val)); if (file) fd.append('valuationFile', file);
    const r = await API.upload(`/api/listings/${listing.id}/valuation`, fd);
    if (r.error) { setErr(r.error); return; }
    showT('Valuation submitted for approval.'); load(); onChanged && onChanged();
  };
  if (!v) return null;
  const val = v.valuation;
  return (
    <div>
      <p style={{ ...muted, marginBottom: 10 }}>{v.required ? 'This deal is above $5M GRV, so an independent completion valuation is required before distributions.' : 'A valuation is not required below $5M GRV, but you may submit one.'} The platform verifies the valuer's registration before approving.</p>
      <div style={{ marginBottom: 10 }}>Status: <Pill status={v.status === 'none' ? 'missing' : v.status}>{v.status === 'none' ? 'not submitted' : v.status}</Pill></div>
      {val && <div style={{ fontSize: 12, marginBottom: 10 }}>{val.valuerName} ({val.valuerRegistration}) · {money(val.valueAmount)} · {dt(val.valuationDate)}{val.adminNotes ? ` · Notes: ${val.adminNotes}` : ''}</div>}
      {v.status !== 'approved' && <>
        <Grid>
          <Input label="Valuer name" value={f.valuerName} onChange={e => setF(p => ({ ...p, valuerName: e.target.value }))} />
          <Input label="Valuer registration no." value={f.valuerRegistration} onChange={e => setF(p => ({ ...p, valuerRegistration: e.target.value }))} />
          <Input label="Valuation date" type="date" value={f.valuationDate} onChange={e => setF(p => ({ ...p, valuationDate: e.target.value }))} />
          <Input label="Valuation amount" inputMode="decimal" value={f.valueAmount} onChange={e => setF(p => ({ ...p, valueAmount: e.target.value }))} />
        </Grid>
        <div style={{ marginTop: 8 }}><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0] || null)} /></div>
        <Err e={err} />
        <button className="btn btn-g btn-sm" style={{ marginTop: 10 }} onClick={submit}>Submit valuation</button>
      </>}
    </div>
  );
}

// ── Capital certainty ──
export function CapitalPanel({ listing }) {
  const [c, setC] = useState(null);
  useEffect(() => { API.get(`/api/listings/${listing.id}/capital-certainty`).then(r => { if (!r.error) setC(r); }); }, [listing.id]);
  if (!c) return null;
  const stat = (n, l) => <div style={{ minWidth: 110 }}><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: 'var(--gold)', lineHeight: 1 }}>{n}</div><div style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>{l}</div></div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {stat(c.score + '/100', 'Capital certainty')}{stat(c.coveragePct + '%', 'Confirmed coverage')}{stat(money(c.confirmedAmount), 'Confirmed interest')}{stat(c.confirmed, 'Confirmed')}{stat(c.pending, 'Awaiting confirmation')}{stat(c.withdrawn + c.lapsed, 'Withdrawn / lapsed')}
      </div>
      <div style={{ fontSize: 12, marginTop: 14 }}>Predicted close: <strong>{c.predictedClose ? dt(c.predictedClose) : 'not enough data yet'}</strong>. {c.velocityNote}</div>
      <p style={{ ...muted, marginTop: 10 }}>{c.definition} Updated live from investor confirmations.</p>
    </div>
  );
}

// ── Drawdowns ──
export function DrawdownPanel({ listing, stages, showT }) {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ stageId: '', amount: '', notes: '' });
  const [err, setErr] = useState('');
  const load = () => API.get(`/api/listings/${listing.id}/drawdowns`).then(r => setList(r.drawdowns || []));
  useEffect(() => { load(); }, [listing.id]);
  const eligible = (stages || []).filter(s => s.subcontractorId);
  const req = async () => {
    setErr('');
    const r = await API.post(`/api/listings/${listing.id}/stages/${f.stageId}/drawdown`, { amount: f.amount, notes: f.notes });
    if (r.error) { setErr(r.error); return; }
    showT(r.drawdown.status === 'ready' ? 'All checks passed. Ready for release.' : 'Drawdown is blocked. See the failed checks.'); setF({ stageId: '', amount: '', notes: '' }); load();
  };
  const recheck = async id => { const r = await API.post(`/api/listings/${listing.id}/drawdowns/${id}/recheck`, {}); if (r.error) showT(r.error); load(); };
  return (
    <div>
      <p style={{ ...muted, marginBottom: 10 }}>A drawdown can only be marked ready when the stage is scored, the milestone certificate is signed, the contractor's licence and insurance are verified and current, and your FEASO is locked. Prop Dev DNA never holds or moves funds. Release is recorded against the trustee's reference.</p>
      <Grid>
        <div><label style={{ fontSize: 10, color: 'var(--muted)' }}>Stage</label><select className="fi" style={lightFi} value={f.stageId} onChange={e => setF(p => ({ ...p, stageId: e.target.value }))}><option value="">Select…</option>{eligible.map(s => <option key={s.id} value={s.id}>{s.name} — {s.subcontractorName}</option>)}</select></div>
        <Input label="Amount" inputMode="decimal" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} />
        <Input label="Notes" value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} />
      </Grid>
      <Err e={err} />
      <button className="btn btn-g btn-sm" style={{ marginTop: 10 }} disabled={!f.stageId || !f.amount} onClick={req}>Request drawdown</button>
      {list.map(d => (
        <div key={d.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 14, paddingTop: 10 }}>
          <div style={{ fontSize: 13 }}><strong>{d.stageName}</strong> · {money(d.amount)} · {d.contractor} <Pill status={d.status} />{d.releaseRef && <span style={muted}> ref {d.releaseRef}</span>}</div>
          {d.checks.map(c => <div key={c.key} style={{ fontSize: 11, color: c.pass ? '#27ae60' : '#C0392B' }}>{c.pass ? '✓' : '✗'} {c.label} <span style={{ color: 'var(--muted)' }}>({c.detail})</span></div>)}
          {['ready', 'blocked'].includes(d.status) && <button className="btn btn-o btn-sm" style={{ marginTop: 6, color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' }} onClick={() => recheck(d.id)}>Re-check</button>}
        </div>
      ))}
    </div>
  );
}

// ── Submit for review ──
export function ReviewPanel({ listing, showT, onChanged }) {
  const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    const r = await API.post(`/api/listings/${listing.id}/im-review`, {});
    if (r.error) { setErr(r.error); return; }
    showT('Submitted for platform review.'); onChanged && onChanged();
  };
  const steps = [['Project created', true], ['FEASO locked (15% minimum margin)', listing.feasoStatus === 'locked'], ['Submitted for review', ['pending_review', 'active'].includes(listing.status)], ['Approved and live to investors', listing.status === 'active']];
  return (
    <div>
      {steps.map(([l, ok]) => <div key={l} style={{ fontSize: 13, padding: '4px 0', color: ok ? '#27ae60' : 'var(--muted)' }}>{ok ? '✓' : '○'} {l}</div>)}
      {listing.status === 'draft' && <button className="btn btn-g btn-sm" style={{ marginTop: 12 }} onClick={submit}>Submit for review →</button>}
      {listing.status === 'pending_review' && <p style={{ ...muted, marginTop: 10 }}>Under review. The platform will approve it or request amendments.</p>}
      <Err e={err} />
    </div>
  );
}

// ── Workspace: one card per project, with tabs ──
export function DevWorkspace({ listing, showT, stages, stagesNode, onChanged }) {
  const tabs = [['stages', 'Stages & scoring'], ['feaso', 'FEASO'], ['review', 'Review'], ['actuals', 'Actuals'], ['valuation', 'Valuation'], ['capital', 'Capital certainty'], ['drawdowns', 'Drawdowns']];
  const [tab, setTab] = useState('stages');
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Sans',sans-serif", color: tab === k ? 'var(--ink)' : 'var(--muted)', borderBottom: tab === k ? '2px solid var(--gold)' : '2px solid transparent', marginBottom: -1 }}>{l}</button>)}
      </div>
      {tab === 'stages' && stagesNode}
      {tab === 'feaso' && <FeasoBuilder listing={listing} showT={showT} onChanged={onChanged} />}
      {tab === 'review' && <ReviewPanel listing={listing} showT={showT} onChanged={onChanged} />}
      {tab === 'actuals' && <ActualsForm listing={listing} showT={showT} onChanged={onChanged} />}
      {tab === 'valuation' && <ValuationForm listing={listing} showT={showT} onChanged={onChanged} />}
      {tab === 'capital' && <CapitalPanel listing={listing} />}
      {tab === 'drawdowns' && <DrawdownPanel listing={listing} stages={stages} showT={showT} />}
    </div>
  );
}

// ── Subcontractor: compliance profile ──
export function ContractorProfile({ showT }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [files, setFiles] = useState({});
  const [err, setErr] = useState('');
  const load = () => API.get('/api/my/contractor').then(r => {
    if (r.error) return;
    setD(r);
    const c = r.contractor || {};
    setF({ businessName: c.businessName || '', abn: c.abn || '', trade: c.trade || '', phone: c.phone || '', licenceNumber: c.licenceNumber || '', licenceClass: c.licenceClass || '', licenceState: c.licenceState || '', licenceExpiry: (c.licenceExpiry || '').slice(0, 10), insurerName: c.insurerName || '', policyNumber: c.policyNumber || '', insuranceExpiry: (c.insuranceExpiry || '').slice(0, 10), publicLiability: c.publicLiability || '', codeAccepted: !!c.codeAccepted, listedInDirectory: c.listedInDirectory !== false });
  });
  useEffect(() => { load(); }, []);
  if (!d || !f) return null;
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    setErr('');
    const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    if (files.licenceFile) fd.append('licenceFile', files.licenceFile); if (files.insuranceFile) fd.append('insuranceFile', files.insuranceFile);
    const r = await API.upload('/api/my/contractor', fd);
    if (r.error) { setErr(r.error); return; }
    showT('Saved. Changed details go back for verification.'); setFiles({}); load();
  };
  const comp = d.compliance;
  return (
    <div style={{ ...box, marginBottom: 20 }}>
      <div style={h3}>Licence and insurance</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, fontSize: 12, alignItems: 'center' }}>
        Licence <Pill status={comp.licence} /> Insurance <Pill status={comp.insurance} /> {comp.compliant ? <span style={{ color: '#27ae60' }}>Fully compliant: you can be drawn against and can appear in the directory.</span> : <span style={{ color: 'var(--muted)' }}>Both must be verified and current.</span>}
      </div>
      <p style={{ ...muted, marginBottom: 12 }}>Prop Dev DNA checks your licence against the state register and your certificate of currency. Changing licence or insurance details sends them back for checking. You'll be emailed 30 days before either expires.</p>
      <Grid>
        <Input label="Business name" value={f.businessName} onChange={e => set('businessName', e.target.value)} />
        <Input label="ABN (11 digits)" value={f.abn} onChange={e => set('abn', e.target.value)} />
        <div><label style={{ fontSize: 10, color: 'var(--muted)' }}>Trade</label><select className="fi" style={lightFi} value={f.trade} onChange={e => set('trade', e.target.value)}><option value="">Select…</option>{d.trades.map(t => <option key={t}>{t}</option>)}</select></div>
        <Input label="Phone (shown to developers only)" value={f.phone} onChange={e => set('phone', e.target.value)} />
        <Input label="Licence number" value={f.licenceNumber} onChange={e => set('licenceNumber', e.target.value)} />
        <Input label="Licence class" value={f.licenceClass} onChange={e => set('licenceClass', e.target.value)} />
        <div><label style={{ fontSize: 10, color: 'var(--muted)' }}>Licensing state</label><select className="fi" style={lightFi} value={f.licenceState} onChange={e => set('licenceState', e.target.value)}><option value="">Select…</option>{d.states.map(t => <option key={t}>{t}</option>)}</select></div>
        <Input label="Licence expiry" type="date" value={f.licenceExpiry} onChange={e => set('licenceExpiry', e.target.value)} />
        <Input label="Insurer" value={f.insurerName} onChange={e => set('insurerName', e.target.value)} />
        <Input label="Policy number" value={f.policyNumber} onChange={e => set('policyNumber', e.target.value)} />
        <Input label="Insurance expiry" type="date" value={f.insuranceExpiry} onChange={e => set('insuranceExpiry', e.target.value)} />
        <Input label="Public liability cover" value={f.publicLiability} onChange={e => set('publicLiability', e.target.value)} />
      </Grid>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 10, fontSize: 12 }}>
        <div>Licence copy {d.contractor && d.contractor.hasLicenceFile ? '(on file) ' : ''}<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFiles(p => ({ ...p, licenceFile: e.target.files[0] }))} /></div>
        <div>Certificate of currency {d.contractor && d.contractor.hasInsuranceFile ? '(on file) ' : ''}<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFiles(p => ({ ...p, insuranceFile: e.target.files[0] }))} /></div>
      </div>
      <label style={{ display: 'flex', gap: 8, fontSize: 12, marginTop: 12, lineHeight: 1.6 }}><input type="checkbox" checked={f.codeAccepted} onChange={e => set('codeAccepted', e.target.checked)} /><span>I agree to the Prop Dev DNA Tradesman Code of Conduct: safe work, honest communication, accurate milestone reporting, and cooperation in resolving disputes.</span></label>
      <label style={{ display: 'flex', gap: 8, fontSize: 12, marginTop: 8 }}><input type="checkbox" checked={f.listedInDirectory} onChange={e => set('listedInDirectory', e.target.checked)} /><span>List me in the public directory once verified</span></label>
      <Err e={err} />
      <button className="btn btn-g btn-sm" style={{ marginTop: 12 }} onClick={save}>Save details</button>
    </div>
  );
}

// ── Admin console for the new controls ──
export function AdminConsole({ showT }) {
  const TABS = [['investors', 'Investors & tiers'], ['funds', 'Proof of funds'], ['contractors', 'Contractors'], ['valuations', 'Valuations'], ['drawdowns', 'Drawdowns'], ['partners', 'Partners'], ['enquiries', 'Project enquiries'], ['system', 'System']];
  const [tab, setTab] = useState('investors');
  const [res, setRes] = useState(null);
  const d = res && res.tab === tab ? res.data : null;   // data is only used for the tab it was loaded for
  const ok = !!d && !d.error;
  const [checked, setChecked] = useState({});
  const [text, setText] = useState({});
  const URL = { investors: '/api/admin/investors', funds: '/api/admin/funds-proofs', contractors: '/api/admin/contractors', valuations: '/api/admin/valuations', drawdowns: '/api/admin/drawdowns', partners: '/api/admin/partners', enquiries: '/api/admin/project-enquiries', system: '/api/admin/system' };
  const load = () => { const t = tab; API.get(URL[t]).then(data => setRes({ tab: t, data })); };
  useEffect(() => { load(); setChecked({}); setText({}); }, [tab]);
  const run = async (fn, ok) => { const r = await fn(); if (r.error) { showT(r.error); return; } showT(ok); load(); };
  const chk = k => <label style={{ fontSize: 11, display: 'block', margin: '6px 0' }}><input type="checkbox" checked={!!checked[k]} onChange={e => setChecked(c => ({ ...c, [k]: e.target.checked }))} /> </label>;
  const [np, setNp] = useState({ name: '', firm: '', role: 'Buyers Agent', email: '', phone: '', licenceNumber: '' });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Sans',sans-serif", color: tab === k ? 'var(--ink)' : 'var(--muted)', borderBottom: tab === k ? '2px solid var(--gold)' : '2px solid transparent', marginBottom: -1 }}>{l}</button>)}
      </div>
      {!d && <p style={muted}>Loading…</p>}
      {d && d.error && <p style={{ ...muted, color: '#C0392B' }}>{d.error}</p>}

      {ok && tab === 'investors' && (d.investors || []).map(i => (
        <div key={i.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 13 }}><strong>{i.name}</strong> · {i.email}<div style={muted}>Tier: {i.tier} · wholesale {i.wholesaleStatus} · funds {i.fundsStatus} · education {i.educationCompletedAt ? 'done' : 'not done'}</div></div>
          {i.tier === 'funds' && <button className="btn btn-g btn-sm" onClick={() => run(() => API.post(`/api/admin/users/${i.id}/endorse`, { endorsed: true }), 'Endorsed (Tier 4).')}>Endorse (Tier 4)</button>}
          {i.endorsed && <button className="btn btn-o btn-sm" style={{ color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' }} onClick={() => run(() => API.post(`/api/admin/users/${i.id}/endorse`, { endorsed: false }), 'Endorsement removed.')}>Remove endorsement</button>}
        </div>
      ))}

      {ok && tab === 'funds' && (d.proofs || []).map(p => (
        <div key={p.id} style={box}>
          <div style={{ fontSize: 13 }}><strong>{p.userName}</strong> · {p.proofType} <Pill status={p.status} /></div>
          <div style={muted}>{dt(p.submittedAt)} · <a href={`/api/admin/funds-proofs/${p.id}/download`} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>Download</a>{p.note ? ` · ${p.note}` : ''}</div>
          {p.status === 'pending' && <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input className="fi" style={{ ...lightFi, flex: 1, minWidth: 160 }} placeholder="Notes (for rejection)" value={text[p.id] || ''} onChange={e => setText(t => ({ ...t, [p.id]: e.target.value }))} />
            <button className="btn btn-g btn-sm" onClick={() => run(() => API.post(`/api/admin/funds-proofs/${p.id}/approve`, {}), 'Funds verified (Tier 3).')}>Verify</button>
            <button className="btn btn-d btn-sm" onClick={() => run(() => API.post(`/api/admin/funds-proofs/${p.id}/reject`, { notes: text[p.id] }), 'Rejected.')}>Reject</button>
          </div>}
        </div>
      ))}

      {ok && tab === 'contractors' && (d.contractors || []).map(c => (
        <div key={c.userId} style={box}>
          <div style={{ fontSize: 13 }}><strong>{c.contractor ? c.contractor.businessName : c.name}</strong> · {c.email} {c.contractor && c.contractor.demo && <Pill status="warn">Demo</Pill>}</div>
          {!c.contractor && <div style={muted}>No compliance profile submitted yet.</div>}
          {c.contractor && ['licence', 'insurance'].map(kind => {
            const k = c.userId + kind;
            const v = c.contractor.verification[kind] || {};
            const summary = kind === 'licence' ? `${c.contractor.licenceState} licence ${c.contractor.licenceNumber} (${c.contractor.licenceClass || 'class n/a'}), expires ${dt(c.contractor.licenceExpiry)}` : `${c.contractor.insurerName} policy ${c.contractor.policyNumber}, expires ${dt(c.contractor.insuranceExpiry)}`;
            const file = c.contractor[kind + 'File'];
            return <div key={kind} style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 8, paddingTop: 8 }}>
              <div style={{ fontSize: 12 }}><strong style={{ textTransform: 'capitalize' }}>{kind}</strong> <Pill status={c.compliance[kind]} /> — {summary}{file && <> · <a href={`/api/admin/contractors/${c.userId}/file/${kind}`} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>{file.fileName}</a></>}</div>
              {v.status === 'pending' && <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 11, display: 'flex', gap: 6 }}><input type="checkbox" checked={!!checked[k]} onChange={e => setChecked(x => ({ ...x, [k]: e.target.checked }))} /> {kind === 'licence' ? `I checked this licence on the ${c.contractor.licenceState} state register` : 'I checked the certificate of currency'}</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <input className="fi" style={{ ...lightFi, flex: 1, minWidth: 160 }} placeholder="Notes" value={text[k] || ''} onChange={e => setText(t => ({ ...t, [k]: e.target.value }))} />
                  <button className="btn btn-g btn-sm" onClick={() => run(() => API.post(`/api/admin/contractors/${c.userId}/verify`, { kind, status: 'verified', registerChecked: !!checked[k], notes: text[k] }), `${kind} verified.`)}>Verify</button>
                  <button className="btn btn-d btn-sm" onClick={() => run(() => API.post(`/api/admin/contractors/${c.userId}/verify`, { kind, status: 'rejected', notes: text[k] }), `${kind} rejected.`)}>Reject</button>
                </div>
              </div>}
            </div>;
          })}
        </div>
      ))}

      {ok && tab === 'valuations' && ((d.items || []).length === 0 ? <p style={muted}>No valuations required or submitted.</p> : d.items.map(i => (
        <div key={i.listingId} style={box}>
          <div style={{ fontSize: 13 }}><strong>{i.name}</strong> · GRV {money(i.grv)} {i.required && <Pill status="warn">Valuation required</Pill>} {i.valuation && <Pill status={i.valuation.status} />}</div>
          {i.valuation && <div style={muted}>{i.valuation.valuerName} ({i.valuation.valuerRegistration}) · {money(i.valuation.valueAmount)} · {dt(i.valuation.valuationDate)} · <a href={`/api/listings/${i.listingId}/valuation/file`} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>Download</a></div>}
          {i.valuation && i.valuation.status === 'submitted' && <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, display: 'flex', gap: 6 }}><input type="checkbox" checked={!!checked[i.listingId]} onChange={e => setChecked(x => ({ ...x, [i.listingId]: e.target.checked }))} /> I have verified the valuer's registration</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn btn-g btn-sm" onClick={() => run(() => API.post(`/api/admin/listings/${i.listingId}/valuation/approve`, { registrationChecked: !!checked[i.listingId] }), 'Valuation approved.')}>Approve</button>
              <button className="btn btn-d btn-sm" onClick={() => run(() => API.post(`/api/admin/listings/${i.listingId}/valuation/reject`, {}), 'Valuation rejected.')}>Reject</button>
            </div>
          </div>}
        </div>
      )))}

      {ok && tab === 'drawdowns' && ((d.drawdowns || []).length === 0 ? <p style={muted}>No drawdown requests.</p> : d.drawdowns.map(x => (
        <div key={x.id} style={box}>
          <div style={{ fontSize: 13 }}><strong>{x.listingName}</strong> · {x.stageName} · {money(x.amount)} <Pill status={x.status} />{x.releaseRef && <span style={muted}> ref {x.releaseRef}</span>}</div>
          {x.reasons.length > 0 && <div style={{ fontSize: 11, color: '#C0392B' }}>{x.reasons.join(' · ')}</div>}
          {x.status === 'ready' && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input className="fi" style={{ ...lightFi, flex: 1 }} placeholder="Trustee release reference" value={text[x.id] || ''} onChange={e => setText(t => ({ ...t, [x.id]: e.target.value }))} />
            <button className="btn btn-g btn-sm" onClick={() => run(() => API.post(`/api/admin/listings/${x.listingId}/drawdowns/${x.id}/release`, { reference: text[x.id] }), 'Release recorded.')}>Record release</button>
          </div>}
        </div>
      )))}

      {ok && tab === 'partners' && <>
        <div style={box}>
          <div style={h3}>Add partner (introducing professional)</div>
          <Grid>
            <Input label="Name" value={np.name} onChange={e => setNp(p => ({ ...p, name: e.target.value }))} />
            <Input label="Firm" value={np.firm} onChange={e => setNp(p => ({ ...p, firm: e.target.value }))} />
            <div><label style={{ fontSize: 10, color: 'var(--muted)' }}>Role</label><select className="fi" style={lightFi} value={np.role} onChange={e => setNp(p => ({ ...p, role: e.target.value }))}>{['Buyers Agent', 'Accountant', 'Financial Adviser', 'Mortgage Broker', 'Other'].map(r => <option key={r}>{r}</option>)}</select></div>
            <Input label="Email" value={np.email} onChange={e => setNp(p => ({ ...p, email: e.target.value }))} />
            <Input label="Phone" value={np.phone} onChange={e => setNp(p => ({ ...p, phone: e.target.value }))} />
            <Input label="Licence number" value={np.licenceNumber} onChange={e => setNp(p => ({ ...p, licenceNumber: e.target.value }))} />
          </Grid>
          <button className="btn btn-g btn-sm" style={{ marginTop: 10 }} onClick={() => run(() => API.post('/api/admin/partners', np), 'Partner added.')}>Add partner</button>
        </div>
        {(d.partners || []).map(p => <div key={p.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><div style={{ fontSize: 13 }}><strong>{p.name}</strong> · {p.firm} · {p.role}<div style={muted}>Code {p.referralCode} · {p.referralCount || 0} referrals · {p.active ? 'listed' : 'inactive'}</div></div><button className="btn btn-o btn-sm" style={{ color: 'var(--muted)', borderColor: 'rgba(0,0,0,0.2)' }} onClick={() => run(() => API.post(`/api/admin/partners/${p.id}/toggle`, {}), 'Updated.')}>{p.active ? 'Deactivate' : 'Activate'}</button></div>)}
      </>}

      {ok && tab === 'enquiries' && ((d.enquiries || []).length === 0 ? <p style={muted}>No project enquiries yet.</p> : d.enquiries.map(e => <div key={e.id} style={box}><div style={{ fontSize: 13 }}><strong>{e.company}</strong> · {e.name} · {e.email} {e.phone && `· ${e.phone}`}</div><div style={muted}>{e.type || 'project'} · raise {e.raise || 'not stated'} · {dt(e.createdAt)}</div></div>))}

      {ok && tab === 'system' && <div style={box}>
        {(d.warnings || []).length === 0 ? <p style={{ fontSize: 13, color: '#27ae60' }}>Nothing needs attention.</p> : d.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: '#C0392B', marginBottom: 6 }}>⚠ {w}</div>)}
        <div style={{ ...muted, marginTop: 10 }}>Email {d.emailConfigured ? 'configured' : 'NOT configured'} · base URL {d.baseUrl} · data directory {d.dataDir} {d.dataDirIsCustom ? '(custom)' : '(default)'} · database {d.dbBytes != null ? Math.round(d.dbBytes / 1024) + ' KB' : 'n/a'} · {d.backups} backups (latest {d.lastBackup || 'none'}) · {d.counts.users} users, {d.counts.listings} listings, {d.counts.interests} interests</div>
      </div>}
    </div>
  );
}
