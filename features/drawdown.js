// Drawdown gating. The platform never holds or moves money. A drawdown request is checked against the
// contractor's current licence and insurance, the scored stage, the signed milestone certificate and a locked FEASO.
// Only when every check passes can an admin record the trustee's release against a reference.
module.exports = function (app, ctx) {
  const { readDB, writeDB, requireAuth, requireDev, requireAdmin, sendEmail, esc, ADMIN_EMAIL, parseNum, contractorCompliance } = ctx;

  function evaluate(db, listing, stage) {
    const sub = db.users.find(u => u.id === stage.subcontractorId);
    const comp = contractorCompliance(sub);
    const checks = [
      { key: 'scored', label: 'Stage scored against benchmarks', pass: stage.status === 'scored', detail: stage.status === 'scored' ? `Score ${stage.score.overall}/5` : 'Stage has not been scored' },
      { key: 'certificate', label: 'Milestone certificate signed by builder and inspector', pass: !!stage.certificate, detail: stage.certificate ? `Issued ${new Date(stage.certificate.issuedAt).toLocaleDateString('en-AU')}` : 'No certificate issued' },
      { key: 'licence', label: 'Contractor licence verified and current', pass: comp.licence === 'verified', detail: `Licence: ${comp.licence}` },
      { key: 'insurance', label: 'Contractor insurance verified and current', pass: comp.insurance === 'verified', detail: `Insurance: ${comp.insurance}` },
      { key: 'feaso', label: 'FEASO locked', pass: !!(listing.feaso && listing.feaso.status === 'locked'), detail: listing.feaso && listing.feaso.status === 'locked' ? `Version ${listing.feaso.version}` : 'FEASO not locked' }
    ];
    return { checks, passed: checks.every(c => c.pass), reasons: checks.filter(c => !c.pass).map(c => c.label + ' — ' + c.detail) };
  }

  function loadStage(req, db) {
    const user = db.users.find(u => u.id === req.session.userId);
    const listing = db.listings.find(l => l.id === req.params.id);
    if (!listing) return { code: 404, error: 'Listing not found.' };
    if (!(user.role === 'admin' || listing.devId === user.id)) return { code: 403, error: 'Not your listing.' };
    const stage = (listing.stages || []).find(s => s.id === req.params.stageId);
    if (req.params.stageId && !stage) return { code: 404, error: 'Stage not found.' };
    return { user, listing, stage };
  }

  app.post('/api/listings/:id/stages/:stageId/drawdown', requireDev, (req, res) => {
    const db = readDB();
    const o = loadStage(req, db);
    if (o.error) return res.status(o.code).json({ error: o.error });
    const amount = parseNum(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Enter the drawdown amount.' });
    if (!o.stage.subcontractorId) return res.status(400).json({ error: 'Assign a contractor to this stage first.' });
    const open = (o.listing.drawdowns || []).find(d => d.stageId === o.stage.id && ['ready', 'blocked'].includes(d.status));
    if (open) return res.status(400).json({ error: 'There is already an open drawdown request for this stage. Re-check it instead.' });
    const ev = evaluate(db, o.listing, o.stage);
    const d = {
      id: 'dd-' + Date.now(), stageId: o.stage.id, stageName: o.stage.name, contractor: o.stage.subcontractorName, amount,
      notes: String(req.body.notes || '').slice(0, 500), requestedAt: new Date().toISOString(), requestedBy: o.user.id,
      status: ev.passed ? 'ready' : 'blocked', checks: ev.checks, reasons: ev.reasons, checkedAt: new Date().toISOString(), releasedAt: null, releaseRef: null
    };
    if (!o.listing.drawdowns) o.listing.drawdowns = [];
    o.listing.drawdowns.push(d);
    writeDB(db);
    if (d.status === 'ready') {
      [ADMIN_EMAIL, o.listing.trusteeEmail].filter(Boolean).forEach(a => sendEmail(a, `Drawdown ready for release — ${o.listing.name}`, `<p style="color:#888">A drawdown of <strong style="color:#c9a84c">$${amount.toLocaleString('en-AU')}</strong> for <strong>${esc(o.stage.name)}</strong> on <strong>${esc(o.listing.name)}</strong> has passed every platform check. Prop Dev DNA does not hold or move funds; release is a matter for the trustee and lender.</p>`));
    }
    res.json({ ok: true, drawdown: d });
  });

  app.post('/api/listings/:id/drawdowns/:did/recheck', requireDev, (req, res) => {
    const db = readDB();
    req.params.stageId = undefined;
    const o = loadStage(req, db);
    if (o.error) return res.status(o.code).json({ error: o.error });
    const d = (o.listing.drawdowns || []).find(x => x.id === req.params.did);
    if (!d) return res.status(404).json({ error: 'Drawdown not found.' });
    if (!['ready', 'blocked'].includes(d.status)) return res.status(400).json({ error: 'This drawdown has already been released or closed.' });
    const stage = (o.listing.stages || []).find(s => s.id === d.stageId);
    const ev = evaluate(db, o.listing, stage);
    Object.assign(d, { status: ev.passed ? 'ready' : 'blocked', checks: ev.checks, reasons: ev.reasons, checkedAt: new Date().toISOString() });
    writeDB(db);
    res.json({ ok: true, drawdown: d });
  });

  app.get('/api/listings/:id/drawdowns', requireAuth, (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.userId);
    const listing = db.listings.find(l => l.id === req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    if (!(user.role === 'admin' || user.role === 'regulator' || listing.devId === user.id)) return res.status(403).json({ error: 'Not permitted.' });
    res.json({ drawdowns: (listing.drawdowns || []).slice().reverse() });
  });

  app.post('/api/admin/listings/:id/drawdowns/:did/release', requireAdmin, (req, res) => {
    const db = readDB();
    const listing = db.listings.find(l => l.id === req.params.id);
    const d = listing && (listing.drawdowns || []).find(x => x.id === req.params.did);
    if (!d) return res.status(404).json({ error: 'Drawdown not found.' });
    if (d.status === 'released') return res.status(400).json({ error: 'Already released.' });
    const ref = String(req.body.reference || '').trim();
    if (!ref) return res.status(400).json({ error: "Enter the trustee's release reference." });
    const stage = (listing.stages || []).find(s => s.id === d.stageId);
    const ev = evaluate(db, listing, stage);
    Object.assign(d, { checks: ev.checks, reasons: ev.reasons, checkedAt: new Date().toISOString() });
    if (!ev.passed) { d.status = 'blocked'; writeDB(db); return res.status(400).json({ error: 'A check no longer passes, so this cannot be released.', drawdown: d }); }
    d.status = 'released'; d.releasedAt = new Date().toISOString(); d.releaseRef = ref.slice(0, 120); d.releasedBy = req.session.userId;
    ctx.audit(db, { by: req.session.userId, action: 'drawdown_release_recorded', listingId: listing.id, drawdownId: d.id, reference: d.releaseRef });
    writeDB(db);
    const dev = db.users.find(u => u.id === listing.devId);
    if (dev) sendEmail(dev.email, `Drawdown release recorded — ${listing.name}`, `<p style="color:#888">Release of <strong>$${d.amount.toLocaleString('en-AU')}</strong> for ${esc(d.stageName)} was recorded against reference <strong>${esc(d.releaseRef)}</strong>.</p>`);
    res.json({ ok: true, drawdown: d });
  });

  // All drawdowns across listings (admin console)
  app.get('/api/admin/drawdowns', requireAdmin, (req, res) => {
    const db = readDB();
    res.json({ drawdowns: db.listings.flatMap(l => (l.drawdowns || []).map(d => ({ ...d, listingId: l.id, listingName: l.name }))).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)) });
  });
};
