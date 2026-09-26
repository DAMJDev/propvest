// Contractor accountability: licence and insurance register (admin-verified against the state register
// and the certificate of currency), 30-day expiry alerts, and the public tradesman directory.
// Licence checks are MANUAL: an admin confirms them against the relevant state register. There is no automated feed.
module.exports = function (app, ctx) {
  const { readDB, writeDB, requireAuth, requireAdmin, sendEmail, esc, BASE_URL, ADMIN_EMAIL, crypto, contractorCompliance, round1 } = ctx;

  const TRADES = ['Concrete & Structural', 'Demolition & Excavation', 'Framing & Carpentry', 'Roofing', 'Bricklaying', 'Electrical', 'Plumbing', 'Glazing & Windows', 'Plastering & Painting', 'Tiling & Waterproofing', 'Landscaping', 'Other'];
  const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  const dir = ctx.rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

  const scoreOf = (db, userId) => {
    const scores = [];
    db.listings.forEach(l => (l.stages || []).forEach(s => { if (s.subcontractorId === userId && s.score) scores.push(s.score.overall); }));
    return { avgScore: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null, scoredCount: scores.length };
  };
  const inFuture = d => d && !isNaN(new Date(d)) && new Date(d) > new Date();
  const s = (v, n = 120) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  app.get('/api/tradesmen/meta', (req, res) => res.json({ trades: TRADES, states: STATES }));

  // ── Subcontractor: own profile ──
  app.get('/api/my/contractor', requireAuth, (req, res) => {
    const db = readDB();
    const u = db.users.find(x => x.id === req.session.userId);
    if (u.role !== 'subcontractor') return res.status(403).json({ error: 'Subcontractor account required.' });
    const c = u.contractor ? { ...u.contractor, licenceFile: undefined, insuranceFile: undefined, hasLicenceFile: !!(u.contractor.licenceFile), hasInsuranceFile: !!(u.contractor.insuranceFile) } : null;
    res.json({ contractor: c, compliance: contractorCompliance(u), ...scoreOf(db, u.id), trades: TRADES, states: STATES });
  });

  app.post('/api/my/contractor', requireAuth, ctx.upload('contractor', 'licenceFile', 'insuranceFile'), (req, res) => {
    const db = readDB();
    const u = db.users.find(x => x.id === req.session.userId);
    const files = req.files || {};
    const cleanup = () => Object.values(files).flat().forEach(f => ctx.removeFile(f.filename));
    const bad = m => { cleanup(); return res.status(400).json({ error: m }); };
    if (u.role !== 'subcontractor') { cleanup(); return res.status(403).json({ error: 'Subcontractor account required.' }); }
    const b = req.body || {};
    const abn = String(b.abn || '').replace(/\s/g, '');
    if (!s(b.businessName)) return bad('Business name is required.');
    if (!/^\d{11}$/.test(abn)) return bad('ABN must be 11 digits.');
    if (!TRADES.includes(b.trade)) return bad('Choose your trade.');
    if (!s(b.licenceNumber, 40)) return bad('Licence number is required.');
    if (!STATES.includes(b.licenceState)) return bad('Choose the licensing state.');
    if (!inFuture(b.licenceExpiry)) return bad('Licence expiry must be a future date.');
    if (!s(b.insurerName) || !s(b.policyNumber, 60)) return bad('Insurer and policy number are required.');
    if (!inFuture(b.insuranceExpiry)) return bad('Insurance expiry must be a future date.');
    if (b.codeAccepted !== 'true' && b.codeAccepted !== true) return bad('You must accept the Tradesman Code of Conduct.');

    const prev = u.contractor || {};
    const now = new Date().toISOString();
    const c = {
      publicId: prev.publicId || 'tr-' + crypto.randomBytes(5).toString('hex'),
      businessName: s(b.businessName), abn, trade: b.trade, phone: s(b.phone, 30),
      licenceNumber: s(b.licenceNumber, 40), licenceClass: s(b.licenceClass, 60), licenceState: b.licenceState, licenceExpiry: new Date(b.licenceExpiry).toISOString(),
      insurerName: s(b.insurerName), policyNumber: s(b.policyNumber, 60), insuranceExpiry: new Date(b.insuranceExpiry).toISOString(), publicLiability: s(b.publicLiability, 30),
      codeAccepted: true, codeAcceptedAt: prev.codeAcceptedAt || now,
      listedInDirectory: b.listedInDirectory === 'true' || b.listedInDirectory === true,
      licenceFile: prev.licenceFile || null, insuranceFile: prev.insuranceFile || null,
      verification: prev.verification || {}, alerts: prev.alerts || {}, updatedAt: now
    };
    if (files.licenceFile && files.licenceFile[0]) { ctx.removeFile(c.licenceFile && c.licenceFile.filePath); c.licenceFile = { fileName: files.licenceFile[0].originalname, filePath: files.licenceFile[0].filename }; }
    if (files.insuranceFile && files.insuranceFile[0]) { ctx.removeFile(c.insuranceFile && c.insuranceFile.filePath); c.insuranceFile = { fileName: files.insuranceFile[0].originalname, filePath: files.insuranceFile[0].filename }; }
    // Any change to a verified item sends it back for re-verification.
    const licChanged = ['licenceNumber', 'licenceState', 'licenceExpiry'].some(k => String(prev[k] || '') !== String(c[k])) || !!(files.licenceFile && files.licenceFile[0]);
    const insChanged = ['insurerName', 'policyNumber', 'insuranceExpiry'].some(k => String(prev[k] || '') !== String(c[k])) || !!(files.insuranceFile && files.insuranceFile[0]);
    if (licChanged || !c.verification.licence) { c.verification.licence = { status: 'pending', at: now }; c.alerts.licence = null; }
    if (insChanged || !c.verification.insurance) { c.verification.insurance = { status: 'pending', at: now }; c.alerts.insurance = null; }
    u.contractor = c;
    u.trade = c.trade;
    writeDB(db);
    if (licChanged || insChanged) sendEmail(ADMIN_EMAIL, `Contractor details to verify: ${c.businessName}`, `<p style="color:#888">${esc(c.businessName)} (${esc(c.trade)}) ${licChanged ? 'updated their <strong>licence</strong> ' : ''}${insChanged ? 'updated their <strong>insurance</strong> ' : ''}details. Please verify against the ${esc(c.licenceState)} licence register and the certificate of currency.</p>`);
    res.json({ ok: true, compliance: contractorCompliance(u) });
  });

  // ── Admin verification (manual against the state register / certificate of currency) ──
  app.get('/api/admin/contractors', requireAdmin, (req, res) => {
    const db = readDB();
    res.json({
      contractors: db.users.filter(u => u.role === 'subcontractor').map(u => ({
        userId: u.id, name: (u.fname + ' ' + (u.lname || '')).trim(), email: u.email, contractor: u.contractor ? { ...u.contractor, licenceFile: u.contractor.licenceFile ? { fileName: u.contractor.licenceFile.fileName } : null, insuranceFile: u.contractor.insuranceFile ? { fileName: u.contractor.insuranceFile.fileName } : null } : null,
        compliance: contractorCompliance(u), ...scoreOf(db, u.id)
      }))
    });
  });

  app.get('/api/admin/contractors/:userId/file/:kind(licence|insurance)', requireAdmin, (req, res) => {
    const db = readDB();
    const u = db.users.find(x => x.id === req.params.userId);
    const f = u && u.contractor && u.contractor[req.params.kind + 'File'];
    if (!f) return res.status(404).json({ error: 'No file.' });
    ctx.sendUpload(res, f.filePath, f.fileName);
  });

  app.post('/api/admin/contractors/:userId/verify', requireAdmin, (req, res) => {
    const db = readDB();
    const u = db.users.find(x => x.id === req.params.userId && x.role === 'subcontractor');
    if (!u || !u.contractor) return res.status(404).json({ error: 'Contractor profile not found.' });
    const { kind, status, notes, registerChecked } = req.body;
    if (!['licence', 'insurance'].includes(kind) || !['verified', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid request.' });
    if (status === 'verified' && !registerChecked) return res.status(400).json({ error: kind === 'licence' ? 'Confirm you checked the licence on the state register.' : 'Confirm you checked the certificate of currency.', code: 'check_required' });
    u.contractor.verification[kind] = { status, at: new Date().toISOString(), by: req.session.userId, notes: String(notes || '').slice(0, 300) };
    ctx.audit(db, { by: req.session.userId, action: `contractor_${kind}_${status}`, userId: u.id });
    writeDB(db);
    sendEmail(u.email, `Your ${kind} was ${status}`, `<p style="color:#888">Your ${kind} details were <strong>${status}</strong>.${notes ? ' Notes: ' + esc(notes) : ''}</p><a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Open your dashboard →</a>`);
    res.json({ ok: true, compliance: contractorCompliance(u) });
  });

  // ── Expiry alerts (30 days out, and on expiry) — runs at start-up and daily ──
  function expirySweep() {
    try {
      const db = readDB();
      let changed = false;
      const now = Date.now();
      db.users.filter(u => u.role === 'subcontractor' && u.contractor).forEach(u => {
        const c = u.contractor;
        c.alerts = c.alerts || {};
        [['licence', c.licenceExpiry], ['insurance', c.insuranceExpiry]].forEach(([kind, exp]) => {
          if (!exp || !c.verification[kind] || c.verification[kind].status !== 'verified') return;
          const days = (new Date(exp).getTime() - now) / 86400000;
          const key = `${exp}|${days <= 0 ? 'expired' : 'soon'}`;
          if (days <= 30 && c.alerts[kind] !== key) {
            c.alerts[kind] = key; changed = true;
            const subject = days <= 0 ? `Your ${kind} has expired` : `Your ${kind} expires in ${Math.ceil(days)} days`;
            const body = `<p style="color:#888">${days <= 0 ? `Your ${kind} expired on` : `Your ${kind} expires on`} <strong>${new Date(exp).toLocaleDateString('en-AU')}</strong>. ${days <= 0 ? 'You cannot be drawn against until it is renewed and re-verified.' : 'Update your details before then to stay compliant.'}</p>`;
            sendEmail(u.email, subject, body);
            sendEmail(ADMIN_EMAIL, `${c.businessName}: ${subject}`, body);
          }
        });
      });
      if (changed) writeDB(db);
    } catch (e) { console.error('[contractor expiry sweep]', e.message); }
  }
  setInterval(expirySweep, 24 * 60 * 60 * 1000);
  setTimeout(expirySweep, 5000);
  ctx.expirySweep = expirySweep;

  // ── Public directory: only fully verified, current and opted-in tradespeople ──
  app.get('/api/tradesmen', dir, (req, res) => {
    const db = readDB();
    const trade = req.query.trade, state = req.query.state;
    const items = db.users.filter(u => u.role === 'subcontractor' && u.contractor && u.contractor.listedInDirectory && contractorCompliance(u).compliant)
      .filter(u => (!trade || u.contractor.trade === trade) && (!state || u.contractor.licenceState === state))
      .map(u => ({
        id: u.contractor.publicId, businessName: u.contractor.businessName, trade: u.contractor.trade, state: u.contractor.licenceState, licenceClass: u.contractor.licenceClass,
        demo: !!u.contractor.demo, licenceVerified: true, insuranceVerified: true, licenceExpiry: u.contractor.licenceExpiry, insuranceExpiry: u.contractor.insuranceExpiry, ...scoreOf(db, u.id)
      }))
      .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
    res.json({ items, note: 'Licence and insurance are verified by Prop Dev DNA against the state register and the certificate of currency at the time of listing. Scores come from builders on the platform.' });
  });

  app.get('/api/tradesmen/:id/contact', requireAuth, (req, res) => {
    const db = readDB();
    const viewer = db.users.find(x => x.id === req.session.userId);
    if (!['developer', 'admin'].includes(viewer.role)) return res.status(403).json({ error: 'Contact details are shown to developers and builders on the platform.' });
    const u = db.users.find(x => x.role === 'subcontractor' && x.contractor && x.contractor.publicId === req.params.id && x.contractor.listedInDirectory && contractorCompliance(x).compliant);
    if (!u) return res.status(404).json({ error: 'Not found.' });
    res.json({ businessName: u.contractor.businessName, contactName: (u.fname + ' ' + (u.lname || '')).trim(), email: u.email, phone: u.contractor.phone || null });
  });
};
