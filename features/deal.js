// FEASO actuals vs forecast (with 10% variance alerts) and the independent valuation gate.
module.exports = function (app, ctx) {
  const { readDB, writeDB, requireAuth, requireDev, requireAdmin, sendEmail, esc, ADMIN_EMAIL, parseNum, round1, dealFigures, tierAtLeast } = ctx;
  const ALERT_PCT = 10;
  const VALUATION_GRV = 5000000;

  const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[$,%\s]/g, '')); return Number.isFinite(n) ? n : NaN; };

  function forecastCompletion(l) {
    const t = String(((l.stats || []).find(s => /completion/i.test(s[1])) || [''])[0]);
    const m = /Q([1-4])\s*(\d{4})/i.exec(t);
    return m ? new Date(Number(m[2]), Number(m[1]) * 3, 0) : null;
  }

  function access(req, db, { write } = {}) {
    const user = db.users.find(u => u.id === req.session.userId);
    const listing = db.listings.find(l => l.id === req.params.id);
    if (!listing) return { code: 404, error: 'Listing not found.' };
    const owner = user.role === 'admin' || listing.devId === user.id;
    if (write && !owner) return { code: 403, error: 'Not your listing.' };
    return { user, listing, owner };
  }

  // ── Actuals ────────────────────────────────────────────────
  app.post('/api/listings/:id/actuals', requireDev, ctx.upload('actual', 'qsFile'), (req, res) => {
    const db = readDB();
    const a = access(req, db, { write: true });
    if (a.error) { if (req.file) ctx.removeFile(req.file.filename); return res.status(a.code).json({ error: a.error }); }
    const l = a.listing;
    if (l.status !== 'active') { if (req.file) ctx.removeFile(req.file.filename); return res.status(400).json({ error: 'Actuals can be recorded once a listing is live.' }); }

    const b = req.body || {};
    const milestone = String(b.milestone || '').trim();
    const cost = num(b.actualConstructionCost), total = num(b.actualTotalCost), revenue = num(b.actualRevenue);
    const completion = b.actualCompletion ? new Date(b.actualCompletion) : null;
    if (!milestone) { if (req.file) ctx.removeFile(req.file.filename); return res.status(400).json({ error: 'Name the milestone or reporting period.' }); }
    if ([cost, total, revenue].some(n => Number.isNaN(n) || (n != null && n < 0)) || (completion && isNaN(completion))) { if (req.file) ctx.removeFile(req.file.filename); return res.status(400).json({ error: 'Check the figures and date entered.' }); }
    if (cost == null && total == null && revenue == null && !completion) { if (req.file) ctx.removeFile(req.file.filename); return res.status(400).json({ error: 'Enter at least one actual figure or a completion date.' }); }
    if (!String(b.qsRef || '').trim()) { if (req.file) ctx.removeFile(req.file.filename); return res.status(400).json({ error: 'Reference the QS progress report these figures come from.' }); }

    const fig = dealFigures(l);
    const sellRate = fig.grv ? (fig.sellingCosts || 0) / fig.grv : 0;
    const pct = (act, fc) => (act != null && fc) ? round1((act - fc) / fc * 100) : null;
    const variance = { costPct: pct(cost, fig.construction), revenuePct: pct(revenue, fig.grv), marginPct: null, marginPoints: null, timeDays: null, timePct: null };
    let actualMargin = null;
    if (total && revenue != null) {
      actualMargin = round1(((revenue * (1 - sellRate)) - total) / total * 100);
      if (fig.marginOnCost != null) { variance.marginPoints = round1(actualMargin - fig.marginOnCost); variance.marginPct = fig.marginOnCost ? round1((actualMargin - fig.marginOnCost) / fig.marginOnCost * 100) : null; }
    }
    const fcDate = forecastCompletion(l);
    if (completion && fcDate) {
      variance.timeDays = Math.round((completion - fcDate) / 86400000);
      const holdDays = (parseNum(l.hold) || 3) * 365;
      variance.timePct = round1(variance.timeDays / holdDays * 100);
    }
    const reasons = [];
    if (variance.costPct != null && Math.abs(variance.costPct) >= ALERT_PCT) reasons.push(`Construction cost ${variance.costPct > 0 ? '+' : ''}${variance.costPct}% vs forecast`);
    if (variance.revenuePct != null && Math.abs(variance.revenuePct) >= ALERT_PCT) reasons.push(`Revenue ${variance.revenuePct > 0 ? '+' : ''}${variance.revenuePct}% vs forecast`);
    if (variance.marginPct != null && Math.abs(variance.marginPct) >= ALERT_PCT) reasons.push(`Margin ${actualMargin}% vs ${fig.marginOnCost}% forecast`);
    if (variance.timePct != null && Math.abs(variance.timePct) >= ALERT_PCT) reasons.push(`Completion ${variance.timeDays > 0 ? variance.timeDays + ' days late' : Math.abs(variance.timeDays) + ' days early'}`);

    const entry = {
      id: 'act-' + Date.now(), at: new Date().toISOString(), by: a.user.id, milestone,
      actualConstructionCost: cost, actualTotalCost: total, actualRevenue: revenue, actualMargin,
      actualCompletion: completion ? completion.toISOString() : null,
      qsRef: String(b.qsRef).trim().slice(0, 200), notes: String(b.notes || '').slice(0, 1000),
      qsFile: req.file ? { fileName: req.file.originalname, filePath: req.file.filename } : null,
      forecast: { constructionCost: fig.construction, revenue: fig.grv, marginOnCost: fig.marginOnCost, completion: fcDate ? fcDate.toISOString() : null },
      variance, alert: reasons.length > 0, reasons
    };
    if (!l.actuals) l.actuals = [];
    l.actuals.push(entry);
    writeDB(db);

    if (entry.alert) {
      const investors = [...new Set((db.interests || []).filter(i => i.listingId === l.id && i.status === 'confirmed').map(i => i.email))];
      const dev = db.users.find(u => u.id === l.devId);
      const to = [...new Set([...investors, ADMIN_EMAIL, l.trusteeEmail, dev && dev.email].filter(Boolean))];
      to.forEach(addr => sendEmail(addr, `Variance alert — ${l.name}`, `
        <p style="color:#888">The latest reported actuals for <strong style="color:#c9a84c">${esc(l.name)}</strong> (${esc(milestone)}) differ from the feasibility forecast by ${ALERT_PCT}% or more:</p>
        <ul style="color:#888">${reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <p style="color:#666;font-size:12px">Source: QS report ${esc(entry.qsRef)}. General information only.</p>
      `));
      entry.notified = to.length;
      writeDB(db);
    }
    res.json({ ok: true, entry: { ...entry, qsFile: entry.qsFile ? { fileName: entry.qsFile.fileName } : null } });
  });

  app.get('/api/listings/:id/actuals', requireAuth, (req, res) => {
    const db = readDB();
    const a = access(req, db);
    if (a.error) return res.status(a.code).json({ error: a.error });
    const priv = a.owner || a.user.role === 'regulator';
    if (!priv && !tierAtLeast(a.user, 'verified')) return res.status(403).json({ error: 'Actuals detail is available to wholesale-verified investors.', code: 'tier_required' });
    res.json({ threshold: ALERT_PCT, entries: (a.listing.actuals || []).map(e => ({ ...e, qsFile: e.qsFile ? { fileName: e.qsFile.fileName } : null })).reverse() });
  });

  app.get('/api/listings/:id/actuals/:actId/file', requireAuth, (req, res) => {
    const db = readDB();
    const a = access(req, db);
    if (a.error) return res.status(a.code).json({ error: a.error });
    if (!(a.owner || a.user.role === 'regulator' || tierAtLeast(a.user, 'verified'))) return res.status(403).json({ error: 'Not permitted.' });
    const e = (a.listing.actuals || []).find(x => x.id === req.params.actId);
    if (!e || !e.qsFile) return res.status(404).json({ error: 'No file.' });
    ctx.sendUpload(res, e.qsFile.filePath, e.qsFile.fileName);
  });

  // ── Independent valuation gate ─────────────────────────────
  app.post('/api/listings/:id/valuation', requireDev, ctx.upload('valuation', 'valuationFile'), (req, res) => {
    const db = readDB();
    const a = access(req, db, { write: true });
    if (a.error) { if (req.file) ctx.removeFile(req.file.filename); return res.status(a.code).json({ error: a.error }); }
    const b = req.body || {};
    const valueAmount = num(b.valueAmount);
    const bad = m => { if (req.file) ctx.removeFile(req.file.filename); return res.status(400).json({ error: m }); };
    if (!req.file) return bad('Attach the completion valuation report (PDF, JPG or PNG).');
    if (!String(b.valuerName || '').trim() || !String(b.valuerRegistration || '').trim()) return bad("The valuer's name and registration number are required.");
    if (!valueAmount || valueAmount <= 0) return bad('Enter the valuation amount.');
    if (!b.valuationDate || isNaN(new Date(b.valuationDate))) return bad('Enter the valuation date.');
    const l = a.listing;
    if (l.valuation && l.valuation.filePath) ctx.removeFile(l.valuation.filePath);
    l.valuation = {
      status: 'submitted', valuerName: String(b.valuerName).trim().slice(0, 120), valuerRegistration: String(b.valuerRegistration).trim().slice(0, 60),
      valuationDate: new Date(b.valuationDate).toISOString(), valueAmount, fileName: req.file.originalname, filePath: req.file.filename,
      submittedAt: new Date().toISOString(), submittedBy: a.user.id, approvedAt: null, adminNotes: ''
    };
    writeDB(db);
    sendEmail(ADMIN_EMAIL, `Valuation submitted: ${l.name}`, `<p style="color:#888">A completion valuation was submitted for <strong style="color:#c9a84c">${esc(l.name)}</strong> by ${esc(l.valuation.valuerName)} (${esc(l.valuation.valuerRegistration)}). Please verify the valuer's registration and approve or reject.</p>`);
    res.json({ ok: true, valuation: { ...l.valuation, filePath: undefined } });
  });

  app.get('/api/listings/:id/valuation', requireAuth, (req, res) => {
    const db = readDB();
    const a = access(req, db);
    if (a.error) return res.status(a.code).json({ error: a.error });
    const l = a.listing, fig = dealFigures(l);
    const priv = a.owner || a.user.role === 'regulator';
    const v = l.valuation || null;
    if (!priv && !(v && v.status === 'approved' && tierAtLeast(a.user, 'verified'))) return res.json({ required: !!(fig.grv && fig.grv > VALUATION_GRV), status: v ? v.status : 'none', valuation: null });
    res.json({ required: !!(fig.grv && fig.grv > VALUATION_GRV), status: v ? v.status : 'none', valuation: v ? { ...v, filePath: undefined } : null });
  });

  app.get('/api/listings/:id/valuation/file', requireAuth, (req, res) => {
    const db = readDB();
    const a = access(req, db);
    if (a.error) return res.status(a.code).json({ error: a.error });
    const v = a.listing.valuation;
    if (!v) return res.status(404).json({ error: 'No valuation.' });
    const ok = a.owner || a.user.role === 'regulator' || (v.status === 'approved' && tierAtLeast(a.user, 'verified'));
    if (!ok) return res.status(403).json({ error: 'Not permitted.' });
    ctx.sendUpload(res, v.filePath, v.fileName);
  });

  app.get('/api/admin/valuations', requireAdmin, (req, res) => {
    const db = readDB();
    res.json({
      items: db.listings.map(l => {
        const fig = dealFigures(l);
        return { listingId: l.id, name: l.name, status: l.status, grv: fig.grv, required: !!(fig.grv && fig.grv > VALUATION_GRV), valuation: l.valuation ? { ...l.valuation, filePath: undefined } : null };
      }).filter(i => i.required || i.valuation)
    });
  });

  app.post('/api/admin/listings/:id/valuation/:decision(approve|reject)', requireAdmin, (req, res) => {
    const db = readDB();
    const l = db.listings.find(x => x.id === req.params.id);
    if (!l || !l.valuation) return res.status(404).json({ error: 'No valuation on this listing.' });
    if (req.params.decision === 'approve' && !req.body.registrationChecked) return res.status(400).json({ error: "Confirm you have checked the valuer's registration before approving.", code: 'check_required' });
    l.valuation.status = req.params.decision === 'approve' ? 'approved' : 'rejected';
    l.valuation.adminNotes = String(req.body.notes || '').slice(0, 500);
    l.valuation.approvedAt = req.params.decision === 'approve' ? new Date().toISOString() : null;
    l.valuation.reviewedBy = req.session.userId;
    ctx.audit(db, { by: req.session.userId, action: `valuation_${l.valuation.status}`, listingId: l.id });
    writeDB(db);
    const dev = db.users.find(u => u.id === l.devId);
    if (dev) sendEmail(dev.email, `Valuation ${l.valuation.status} — ${l.name}`, `<p style="color:#888">The completion valuation for <strong style="color:#c9a84c">${esc(l.name)}</strong> was <strong>${l.valuation.status}</strong>.${l.valuation.adminNotes ? ' Notes: ' + esc(l.valuation.adminNotes) : ''}</p>`);
    res.json({ ok: true, valuation: { ...l.valuation, filePath: undefined } });
  });
};
