// Public directories and registries, developer project enquiries, and the admin system status.
module.exports = function (app, ctx) {
  const { readDB, writeDB, requireAuth, requireAdmin, sendEmail, esc, ADMIN_EMAIL, rateLimit, round1, parseNum } = ctx;
  const pub = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
  const form = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many submissions. Please try again later.' } });

  // ── Buyers agent directory (from the admin-managed partner registry) ──
  app.get('/api/directory/buyers-agents', pub, (req, res) => {
    const db = readDB();
    const items = (db.partners || []).filter(p => p.active !== false && /buyers?\s*(agent|advocate)/i.test(p.role || ''))
      .map(p => ({ name: p.name, firm: p.firm || '', licenceNumber: p.licenceNumber || '', agreementSigned: !!p.agreementSigned }));
    res.json({
      items,
      disclosure: 'Buyers agents listed here are independent introducing professionals, not employees of Prop Dev DNA. Ask any agent how they are paid, including any fee or commission connected to a purchase, and check their licence before engaging them. Listing here is not a recommendation.'
    });
  });

  // ── Developer track record registry (computed from platform data only; developers cannot edit it) ──
  app.get('/api/registry/developers', pub, (req, res) => {
    const db = readDB();
    const devs = new Map();
    db.listings.filter(l => l.devId && l.devId !== 'system' && l.status !== 'draft').forEach(l => {
      const owner = db.users.find(u => u.id === l.devId);
      if (!owner) return;
      const entry = devs.get(l.devId) || { name: (l.developer && l.developer.name) || (owner.fname + ' ' + (owner.lname || '')).trim(), listings: [], since: owner.joined };
      entry.listings.push(l);
      devs.set(l.devId, entry);
    });
    const avg = arr => arr.length ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const items = [...devs.values()].map(d => {
      const acts = d.listings.flatMap(l => (l.actuals || []));
      const costVar = acts.map(a => a.variance && a.variance.costPct).filter(v => v != null);
      const marginPts = acts.map(a => a.variance && a.variance.marginPoints).filter(v => v != null);
      const delays = acts.map(a => a.variance && a.variance.timeDays).filter(v => v != null);
      const stages = d.listings.flatMap(l => l.stages || []);
      const scored = stages.filter(s => s.score);
      const completed = d.listings.filter(l => l.status === 'completed').length;
      return {
        name: d.name, onPlatformSince: d.since, projectsListed: d.listings.length, projectsCompleted: completed,
        actualsReports: acts.length, avgCostVariancePct: avg(costVar), avgMarginVariancePoints: avg(marginPts), avgCompletionVarianceDays: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
        stagesScored: scored.length, stagesTotal: stages.length, avgContractorScore: avg(scored.map(s => s.score.overall)),
        milestoneCertificates: stages.filter(s => s.certificate).length
      };
    });
    res.json({
      items,
      note: 'Built automatically from activity on the platform (QS-referenced actuals, contractor stage scores and milestone certificates). Developers cannot edit these figures. A developer with few data points has little history here; this is not an endorsement or a guarantee of future performance.'
    });
  });

  // ── "Submit your project" enquiry (public) ──
  app.post('/api/project-enquiries', form, (req, res) => {
    const b = req.body || {};
    const clean = (v, n = 200) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
    const e = { company: clean(b.company), name: clean(b.name), email: clean(b.email, 160), phone: clean(b.phone, 40), type: clean(b.type), raise: clean(b.raise, 60), site: clean(b.site), notes: clean(b.notes, 1500) };
    if (!e.company || !e.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) return res.status(400).json({ error: 'Company, name and a valid email are required.' });
    const db = readDB();
    if (!db.projectEnquiries) db.projectEnquiries = [];
    const rec = { id: 'enq-' + Date.now(), ...e, status: 'new', createdAt: new Date().toISOString() };
    db.projectEnquiries.push(rec);
    writeDB(db);
    sendEmail(ADMIN_EMAIL, `New project enquiry: ${e.company}`, `<p style="color:#888"><strong>${esc(e.name)}</strong> (${esc(e.email)}, ${esc(e.phone || 'no phone')}) from <strong>${esc(e.company)}</strong> enquired about a <strong>${esc(e.type || 'project')}</strong>, raise target ${esc(e.raise || 'not stated')}.</p>`);
    res.json({ ok: true });
  });

  app.get('/api/admin/project-enquiries', requireAdmin, (req, res) => res.json({ enquiries: (readDB().projectEnquiries || []).slice().reverse() }));

  // ── System status (admin): are the things real users depend on actually configured? ──
  app.get('/api/admin/system', requireAdmin, (req, res) => {
    let dbBytes = null, backups = 0, lastBackup = null;
    try { dbBytes = ctx.fs.statSync(ctx.DB_FILE).size; } catch {}
    try {
      const files = ctx.fs.readdirSync(ctx.BACKUP_DIR).filter(f => f.startsWith('db-')).sort();
      backups = files.length; lastBackup = files.length ? files[files.length - 1] : null;
    } catch {}
    const db = readDB();
    res.json({
      emailConfigured: ctx.smtpConfigured(), baseUrl: ctx.BASE_URL, dataDir: ctx.DATA_DIR,
      dataDirIsCustom: !!process.env.DATA_DIR, dbBytes, backups, lastBackup, nodeEnv: process.env.NODE_ENV || 'development',
      adminPasswordIsDefault: !process.env.ADMIN_PASSWORD, sessionSecretSet: !!process.env.SESSION_SECRET,
      counts: { users: db.users.length, listings: db.listings.length, interests: (db.interests || []).length },
      warnings: [
        !ctx.smtpConfigured() && 'Email (SMTP) is not configured. Accountant links, EOI confirmations, certificates and alerts will not be delivered.',
        !process.env.DATA_DIR && 'DATA_DIR is not set. On Railway, data stored inside the app folder is lost on redeploy unless a volume is mounted there. Attach a volume and set DATA_DIR to its mount path.',
        !process.env.ADMIN_PASSWORD && 'ADMIN_PASSWORD is not set, so the default admin password is in use.',
        !process.env.SESSION_SECRET && 'SESSION_SECRET is not set.'
      ].filter(Boolean)
    });
  });
};
