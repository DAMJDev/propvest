// FEASO builder (server-authoritative maths, 15% margin gate, QS certificate above $2M,
// versioned and locked on submission), waterfall scenarios and the plain-English deal summary.
module.exports = function (app, ctx) {
  const { readDB, writeDB, requireAuth, sendEmail, esc, ADMIN_EMAIL, crypto, parseNum, round1, dealFigures, computeRisk, finRow, tierAtLeast, ADMIN } = ctx;

  const MIN_MARGIN = 15;
  const QS_THRESHOLD = 2000000;
  const NUM_FIELDS = ['landPrice', 'landCosts', 'siteworks', 'constructionCost', 'contingencyPct', 'professionalFees', 'councilFees', 'financeCosts', 'marketing', 'holdingCosts', 'sellingCostsPct', 'grv', 'units', 'holdMonths'];
  const REQUIRED = ['constructionCost', 'grv'];

  function cleanInputs(body) {
    const out = {};
    for (const k of NUM_FIELDS) {
      const raw = body[k];
      const n = raw === '' || raw == null ? 0 : Number(String(raw).replace(/[$,\s]/g, ''));
      if (!Number.isFinite(n) || n < 0) return { error: `"${k}" must be a number of zero or more.` };
      out[k] = n;
    }
    if (out.contingencyPct > 30) return { error: 'Contingency above 30% is not accepted.' };
    if (out.sellingCostsPct > 10) return { error: 'Selling costs above 10% are not accepted.' };
    return { inputs: out };
  }

  function compute(i) {
    const contingency = i.constructionCost * i.contingencyPct / 100;
    const costs = i.landPrice + i.landCosts + i.siteworks + i.constructionCost + contingency + i.professionalFees + i.councilFees + i.financeCosts + i.marketing + i.holdingCosts;
    const sellingCosts = i.grv * i.sellingCostsPct / 100;
    const netRevenue = i.grv - sellingCosts;
    const profit = netRevenue - costs;
    const marginOnCost = costs > 0 ? (profit / costs) * 100 : 0;
    const marginOnGrv = i.grv > 0 ? (profit / i.grv) * 100 : 0;
    const r = n => Math.round(n * 100) / 100;
    return {
      contingency: r(contingency), tdc: r(costs), sellingCosts: r(sellingCosts), netRevenue: r(netRevenue), profit: r(profit),
      marginOnCost: round1(marginOnCost), marginOnGrv: round1(marginOnGrv),
      meetsMinimum: marginOnCost >= MIN_MARGIN, qsRequired: costs > QS_THRESHOLD
    };
  }

  const hashOf = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

  function ownerOf(req, db) {
    const user = db.users.find(u => u.id === req.session.userId);
    const listing = db.listings.find(l => l.id === req.params.id);
    if (!listing) return { code: 404, error: 'Listing not found.' };
    if (!(user.role === 'admin' || listing.devId === user.id)) return { code: 403, error: 'Not your listing.' };
    return { user, listing };
  }

  // Read: owner/admin/regulator see everything (incl. drafts); tier 2+ investors see the locked FEASO read-only.
  app.get('/api/listings/:id/feaso', requireAuth, (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.userId);
    const listing = db.listings.find(l => l.id === req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    const privileged = user.role === 'admin' || user.role === 'regulator' || listing.devId === user.id;
    if (!privileged && !tierAtLeast(user, 'verified')) {
      return res.status(403).json({ error: 'FEASO detail is available to wholesale-verified investors.', code: 'tier_required' });
    }
    const f = listing.feaso || null;
    if (!privileged && (!f || f.status !== 'locked')) return res.json({ feaso: null, financials: listing.financials || null });
    const out = f ? { ...f, qs: f.qs ? { fileName: f.qs.fileName, uploadedAt: f.qs.uploadedAt } : null } : null;
    res.json({ feaso: out, financials: listing.financials || null, rules: { minMargin: MIN_MARGIN, qsThreshold: QS_THRESHOLD } });
  });

  app.put('/api/listings/:id/feaso/draft', ctx.requireDev, (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    const db = readDB();
    const o = ownerOf(req, db);
    if (o.error) return res.status(o.code).json({ error: o.error });
    const listing = o.listing;
    if (listing.feaso && listing.feaso.status === 'locked') return res.status(403).json({ error: 'This FEASO is locked. Inputs cannot be changed after submission.', code: 'locked' });
    const c = cleanInputs(req.body || {});
    if (c.error) return res.status(400).json({ error: c.error });
    const computed = compute(c.inputs);
    const prev = listing.feaso || { versions: [], audit: [], qs: null };
    listing.feaso = { ...prev, status: 'draft', inputs: c.inputs, computed, marginOnCost: computed.marginOnCost, updatedAt: new Date().toISOString() };
    writeDB(db);
    res.json({ ok: true, feaso: listing.feaso, rules: { minMargin: MIN_MARGIN, qsThreshold: QS_THRESHOLD } });
  });

  app.post('/api/listings/:id/feaso/qs', ctx.requireDev, ctx.upload('qs', 'qsFile'), (req, res) => {
    const db = readDB();
    const o = ownerOf(req, db);
    if (o.error) { if (req.file) ctx.removeFile(req.file.filename); return res.status(o.code).json({ error: o.error }); }
    if (!req.file) return res.status(400).json({ error: 'Attach the QS certificate (PDF, JPG or PNG).' });
    const listing = o.listing;
    if (!listing.feaso) { ctx.removeFile(req.file.filename); return res.status(400).json({ error: 'Save your FEASO inputs first.' }); }
    if (listing.feaso.status === 'locked') { ctx.removeFile(req.file.filename); return res.status(403).json({ error: 'This FEASO is locked.' }); }
    if (listing.feaso.qs) ctx.removeFile(listing.feaso.qs.filePath);
    listing.feaso.qs = { fileName: req.file.originalname, filePath: req.file.filename, uploadedAt: new Date().toISOString(), uploadedBy: o.user.id };
    writeDB(db);
    res.json({ ok: true, qs: { fileName: listing.feaso.qs.fileName, uploadedAt: listing.feaso.qs.uploadedAt } });
  });

  app.post('/api/listings/:id/feaso/submit', ctx.requireDev, (req, res) => {
    const db = readDB();
    const o = ownerOf(req, db);
    if (o.error) return res.status(o.code).json({ error: o.error });
    const f = o.listing.feaso;
    if (!f || !f.inputs) return res.status(400).json({ error: 'Save your FEASO inputs first.' });
    if (f.status === 'locked') return res.status(400).json({ error: 'Already submitted and locked.' });
    for (const k of REQUIRED) if (!(f.inputs[k] > 0)) return res.status(400).json({ error: `"${k}" is required.` });
    const computed = compute(f.inputs);
    if (!computed.meetsMinimum) {
      f.status = 'blocked'; f.computed = computed; f.marginOnCost = computed.marginOnCost;
      writeDB(db);
      return res.status(400).json({ error: `Blocked: margin on cost is ${computed.marginOnCost}%, below the ${MIN_MARGIN}% platform minimum. Improve the feasibility before submitting.`, code: 'below_minimum', computed });
    }
    if (computed.qsRequired && !f.qs) return res.status(400).json({ error: `A QS certificate is required when total development cost is above $${(QS_THRESHOLD / 1e6).toFixed(0)}M.`, code: 'qs_required' });

    const at = new Date().toISOString();
    const version = (f.versions || []).length + 1;
    const snapshot = { version, inputs: f.inputs, computed, qsFile: f.qs ? f.qs.fileName : null, submittedAt: at, submittedBy: o.user.id };
    snapshot.hash = hashOf(snapshot);
    f.versions = [...(f.versions || []), snapshot];
    f.status = 'locked'; f.computed = computed; f.marginOnCost = computed.marginOnCost; f.lockedAt = at; f.hash = snapshot.hash; f.version = version;
    f.audit = [...(f.audit || []), { at, by: o.user.id, action: 'submitted_and_locked', version }];
    writeDB(db);
    sendEmail(ADMIN_EMAIL, `FEASO locked: ${o.listing.name}`, `<p style="color:#888"><strong style="color:#c9a84c">${esc(o.listing.name)}</strong> FEASO v${version} was submitted and locked. Margin on cost ${computed.marginOnCost}%.</p>`);
    res.json({ ok: true, feaso: f });
  });

  app.get('/api/listings/:id/feaso/qs', requireAuth, (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.userId);
    const listing = db.listings.find(l => l.id === req.params.id);
    if (!listing || !listing.feaso || !listing.feaso.qs) return res.status(404).json({ error: 'No QS certificate on file.' });
    if (!(user.role === 'admin' || user.role === 'regulator' || listing.devId === user.id)) return res.status(403).json({ error: 'Not permitted.' });
    ctx.sendUpload(res, listing.feaso.qs.filePath, listing.feaso.qs.fileName);
  });

  // Admin can re-open a locked FEASO for a new version (previous versions are kept).
  app.post('/api/admin/listings/:id/feaso/unlock', ctx.requireAdmin, (req, res) => {
    const db = readDB();
    const listing = db.listings.find(l => l.id === req.params.id);
    if (!listing || !listing.feaso) return res.status(404).json({ error: 'No FEASO on this listing.' });
    if (listing.feaso.status !== 'locked') return res.status(400).json({ error: 'FEASO is not locked.' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason is required and is recorded in the audit trail.' });
    listing.feaso.status = 'draft';
    listing.feaso.audit = [...(listing.feaso.audit || []), { at: new Date().toISOString(), by: req.session.userId, action: 'unlocked_by_admin', reason }];
    writeDB(db);
    res.json({ ok: true, feaso: listing.feaso });
  });

  // ── Waterfall scenarios (public, from the listing's own figures) ──
  function waterfall(l) {
    const fig = dealFigures(l);
    if (!fig.tdc || !fig.grv) return { available: false, reason: 'This listing does not have feasibility figures yet.' };
    const raise = parseNum(l.raise) || 0;
    const holdYears = (l.feaso && l.feaso.inputs && l.feaso.inputs.holdMonths ? l.feaso.inputs.holdMonths / 12 : parseNum(l.hold)) || 3;
    const A = { seniorPct: 65, prefRatePct: 12, platformFeePct: 1.5, overrunPct: 15 };
    const senior = fig.tdc * A.seniorPct / 100;
    const investor = Math.min(raise, Math.max(0, fig.tdc - senior));
    const devEquity = Math.max(0, fig.tdc - senior - investor);
    const sellRate = fig.grv ? (fig.sellingCosts || 0) / fig.grv : 0;
    const pref = investor * A.prefRatePct / 100 * holdYears;
    const fee = raise * A.platformFeePct / 100;
    const defs = [
      { key: 'target', label: 'On target', grvMult: 1, overrun: 0 },
      { key: 'overrun', label: `Cost overrun (+${A.overrunPct}% construction)`, grvMult: 1, overrun: A.overrunPct / 100 },
      { key: 'shortfall', label: 'Sales shortfall (revenue −15%)', grvMult: 0.85, overrun: 0 },
      { key: 'downside', label: `Severe downside (revenue −35%, cost +${A.overrunPct}%)`, grvMult: 0.65, overrun: A.overrunPct / 100 }
    ];
    const scenarios = defs.map(d => {
      const grv = fig.grv * d.grvMult;
      const net = grv * (1 - sellRate);
      const overrunCost = (fig.construction || 0) * d.overrun;
      let left = Math.max(0, net - overrunCost);
      const pay = due => { const p = Math.max(0, Math.min(left, due)); left -= p; return p; };
      const tiers = [
        { key: 'senior', label: 'Senior lender — principal', due: senior },
        { key: 'principal', label: 'Investor principal', due: investor },
        { key: 'pref', label: `Investor preferred return (${A.prefRatePct}% p.a., simple)`, due: pref },
        { key: 'fee', label: `Platform success fee (${A.platformFeePct}% of raise)`, due: fee }
      ].map(t => { const paid = pay(t.due); return { ...t, due: Math.round(t.due), paid: Math.round(paid), shortfall: Math.round(t.due - paid) }; });
      const developer = Math.round(left);
      const inv = tiers.find(t => t.key === 'principal').paid + tiers.find(t => t.key === 'pref').paid;
      const annualised = investor > 0 && holdYears > 0 ? (Math.pow(Math.max(inv, 0) / investor, 1 / holdYears) - 1) * 100 : null;
      return {
        key: d.key, label: d.label, revenue: Math.round(grv), netRevenue: Math.round(net), overrunCost: Math.round(overrunCost), distributable: Math.round(Math.max(0, net - overrunCost)),
        tiers, developer, developerProfit: Math.round(developer - devEquity),
        investorPaid: Math.round(inv), investorPrincipalRecoveredPct: investor ? Math.round(tiers[1].paid / investor * 100) : null,
        investorAnnualisedPct: annualised == null ? null : round1(annualised)
      };
    });
    return {
      available: true, source: fig.source, tdc: Math.round(fig.tdc), raise: Math.round(raise), holdYears: round1(holdYears),
      structure: { senior: Math.round(senior), investor: Math.round(investor), developerEquity: Math.round(devEquity) },
      assumptions: [
        `Senior debt is assumed at ${A.seniorPct}% of total development cost.`,
        `Investor capital is the listed raise, ranking after the senior lender.`,
        `Preferred return is ${A.prefRatePct}% p.a. simple over the hold period, paid before the developer.`,
        'Cost overruns are assumed to be met from sale proceeds.',
        'Order of payment: senior lender, investor principal, investor preferred return, platform success fee, then the developer.',
        'These are illustrations from the listing figures, not forecasts or guarantees. The IM sets out the actual terms.'
      ],
      scenarios
    };
  }
  ctx.waterfall = waterfall;

  app.get('/api/listings/:id/waterfall', (req, res) => {
    const db = readDB();
    const l = db.listings.find(x => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Listing not found.' });
    res.json(waterfall(l));
  });

  // ── Plain-English deal summary (five questions, generated from the listing) ──
  app.get('/api/listings/:id/summary', (req, res) => {
    const db = readDB();
    const l = db.listings.find(x => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Listing not found.' });
    const fig = dealFigures(l);
    const risk = computeRisk(l, db.listings);
    const money = n => n == null ? 'not stated' : '$' + Math.round(n).toLocaleString('en-AU');
    const raise = parseNum(l.raise);
    const high = risk.dimensions.filter(d => d.score >= 4);
    const stages = (l.stages || []);
    const scored = stages.filter(s => s.score);
    const track = l.developer && l.developer.completed != null ? `The developer reports ${l.developer.completed} completed project${l.developer.completed === 1 ? '' : 's'} (self-reported, not independently verified by the platform).` : 'The developer has not reported completed projects.';
    res.json({
      listingId: l.id, name: l.name,
      answers: [
        { q: 'What is the project?', a: `${l.name}${l.category ? ' is a ' + String(l.category).toLowerCase() : ''} project${l.loc ? ' at ' + String(l.loc).replace('📍', '').trim() : ''}. ${l.overview ? String(l.overview).split('. ')[0] + '.' : ''}` },
        { q: 'What happens to my money?', a: `You would invest as ${l.structure || 'an equity investor'} in a raise of ${money(raise)} with a minimum of ${l.minInvest || 'not stated'}. Your capital ranks behind the senior lender and ahead of the developer's profit share, is expected to be tied up for about ${l.hold || 'the stated term'}, and is repaid only from sale proceeds. Prop Dev DNA does not hold investor money; funds are handled under the trust arrangements described in the Information Memorandum.` },
        { q: 'What are the key risks?', a: `${high.length ? 'This listing scores higher-risk on: ' + high.map(d => `${d.label.toLowerCase()} (${d.note})`).join('; ') + '. ' : ''}In general, construction can be delayed or cost more than planned, sales can be slower or lower than forecast, and there is no market to sell your interest early. You can lose some or all of your capital.` },
        { q: 'What is the developer\'s track record?', a: `${track} ${scored.length ? `On this project, ${scored.length} of ${stages.length} construction stages have been scored by the developer against on-time, quality, budget and safety benchmarks.` : 'No construction stages have been scored on the platform yet.'}` },
        { q: 'What is the platform\'s view?', a: `The platform's indicative risk score for this listing is ${risk.composite} out of 5 (${risk.band})${fig.marginOnCost != null ? `, with a ${fig.marginOnCost}% margin on cost against a ${MIN_MARGIN}% platform minimum` : ''}. This is general information based on the listing figures. It is not a recommendation and does not consider your circumstances. Consider independent advice.` }
      ],
      risk: { composite: risk.composite, band: risk.band }
    });
  });
};
