// Expressions of interest with a 48-hour confirm-or-withdraw window, and Capital Certainty.
// An EOI is NOT passed to the developer until the investor actively confirms.
// Unconfirmed EOIs lapse after 48 hours. The platform never takes money or a binding commitment here.
module.exports = function (app, ctx) {
  const { readDB, writeDB, requireAuth, sendEmail, esc, BASE_URL, ADMIN_EMAIL, crypto, rateLimit, parseNum, round1, tierAtLeast, investorTier } = ctx;
  const WINDOW_MS = 48 * 60 * 60 * 1000;
  const eoiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } });

  const publicInterest = i => {
    const { confirmToken, ...rest } = i;
    return rest;
  };

  function lapseExpired(db) {
    const now = Date.now();
    let changed = false;
    (db.interests || []).forEach(i => {
      if (i.status === 'pending_confirmation' && new Date(i.confirmBy).getTime() < now) {
        i.status = 'lapsed';
        i.lapsedAt = new Date().toISOString();
        changed = true;
      }
    });
    return changed;
  }

  function notifyConfirmed(db, i) {
    const listing = db.listings.find(l => l.id === i.listingId);
    if (listing && listing.devId !== 'system') {
      const dev = db.users.find(u => u.id === listing.devId);
      if (dev) {
        sendEmail(dev.email, `Confirmed investor interest — ${listing.name}`, `
          <p style="color:#888">An investor has <strong style="color:#c9a84c">confirmed</strong> their expression of interest in <strong style="color:#c9a84c">${esc(listing.name)}</strong>.</p>
          <p style="color:#888"><strong style="color:#e8e2d5">Name:</strong> ${esc(i.fname)} ${esc(i.lname || '')}<br>
          <strong style="color:#e8e2d5">Email:</strong> ${esc(i.email)}<br>
          <strong style="color:#e8e2d5">Phone:</strong> ${esc(i.phone || 'Not provided')}<br>
          <strong style="color:#e8e2d5">Proposed amount:</strong> ${esc(i.amount || 'Not specified')}<br>
          <strong style="color:#e8e2d5">Verification tier:</strong> ${esc(i.tier || 'registered')}<br>
          <strong style="color:#e8e2d5">Ref:</strong> ${esc(i.refCode)}</p>
          <a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View in Portal →</a>
        `);
      }
    }
    sendEmail(ADMIN_EMAIL, `Confirmed investor interest: ${i.fname} → ${listing ? listing.name : i.listingId}`, `
      <p style="color:#888">Investor <strong style="color:#e8e2d5">${esc(i.fname)} ${esc(i.lname || '')}</strong> (${esc(i.email)}) confirmed interest in <strong style="color:#c9a84c">${esc(listing ? listing.name : i.listingId)}</strong>. Amount: ${esc(i.amount || 'unspecified')} · Ref: ${esc(i.refCode)}</p>
    `);
  }

  function decide(db, i, action) {
    if (!i) return { code: 404, error: 'Expression of interest not found.' };
    if (i.status === 'confirmed') return { code: 400, error: 'This expression of interest is already confirmed.' };
    if (i.status === 'withdrawn') return { code: 400, error: 'This expression of interest was withdrawn.' };
    if (i.status === 'lapsed' || new Date(i.confirmBy).getTime() < Date.now()) {
      i.status = 'lapsed';
      return { code: 400, error: 'The 48-hour window has passed and this expression of interest has lapsed. You can submit a new one.', changed: true };
    }
    if (action === 'confirm') {
      i.status = 'confirmed';
      i.confirmedAt = new Date().toISOString();
      return { ok: true, changed: true, confirmed: true };
    }
    i.status = 'withdrawn';
    i.withdrawnAt = new Date().toISOString();
    return { ok: true, changed: true };
  }

  // Create an EOI (pending). Requires sign-in.
  app.post('/api/interests', requireAuth, eoiLimiter, (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.userId);
    const { listingId, fname, lname, email, phone, amount, comments, needsBroker } = req.body;
    if (!listingId || !fname || !email) return res.status(400).json({ error: 'Missing required fields.' });
    const listing = db.listings.find(l => l.id === listingId && l.status === 'active');
    if (!listing) return res.status(404).json({ error: 'Listing not found or not open for interest.' });
    if (!db.interests) db.interests = [];

    const dup = db.interests.find(i => i.userId === user.id && i.listingId === listingId && ['pending_confirmation', 'confirmed'].includes(i.status));
    if (dup) return res.status(400).json({ error: dup.status === 'confirmed' ? 'You have already confirmed interest in this listing.' : 'You already have an expression of interest awaiting confirmation for this listing. Check your email.' });

    const now = Date.now();
    const interest = {
      id: 'int-' + now + '-' + crypto.randomBytes(3).toString('hex'),
      listingId, listingName: listing.name || '—',
      fname: String(fname).slice(0, 80), lname: String(lname || '').slice(0, 80), email: String(email).slice(0, 160),
      phone: String(phone || '').slice(0, 40), amount: String(amount || '').slice(0, 40), comments: String(comments || '').slice(0, 2000),
      needsBroker: !!needsBroker,
      refCode: 'REF-' + new Date().getFullYear() + '-' + listingId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) + '-' + Math.floor(Math.random() * 9000 + 1000),
      userId: user.id,
      tier: investorTier(user) || 'registered',
      status: 'pending_confirmation',
      createdAt: new Date(now).toISOString(),
      confirmBy: new Date(now + WINDOW_MS).toISOString(),
      confirmToken: crypto.randomBytes(24).toString('hex')
    };
    db.interests.push(interest);
    writeDB(db);

    const base = `${BASE_URL}/?page=eoi&token=${interest.confirmToken}`;
    sendEmail(interest.email, `Confirm your expression of interest — ${listing.name}`, `
      <h2 style="color:#e8e2d5;margin:0 0 12px">One more step, ${esc(interest.fname)}</h2>
      <p style="color:#888;line-height:1.7">You expressed interest in <strong style="color:#c9a84c">${esc(listing.name)}</strong> (ref ${esc(interest.refCode)}). This is <strong style="color:#e8e2d5">not binding</strong> and nothing has been sent to the developer yet.</p>
      <p style="color:#888;line-height:1.7">You have <strong style="color:#e8e2d5">48 hours</strong> to confirm or withdraw. If you do nothing, it lapses automatically.</p>
      <a href="${base}&action=confirm" style="display:inline-block;margin:8px 8px 0 0;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Confirm my interest</a>
      <a href="${base}&action=withdraw" style="display:inline-block;margin-top:8px;border:1px solid #555;color:#ccc;padding:12px 24px;border-radius:8px;text-decoration:none">Withdraw</a>
      <p style="color:#666;font-size:12px;margin-top:16px">Expressions of interest do not commit you to invest. Capital is at risk. General information only — not financial product advice.</p>
    `);
    res.json({ ok: true, interest: publicInterest(interest) });
  });

  // Investor's own EOIs (dashboard)
  app.get('/api/my/interests', requireAuth, (req, res) => {
    const db = readDB();
    if (lapseExpired(db)) writeDB(db);
    res.json((db.interests || []).filter(i => i.userId === req.session.userId).map(publicInterest).reverse());
  });

  // Confirm or withdraw from the dashboard (signed in) ...
  app.post('/api/my/interests/:id/:action(confirm|withdraw)', requireAuth, (req, res) => {
    const db = readDB();
    const i = (db.interests || []).find(x => x.id === req.params.id && x.userId === req.session.userId);
    const r = decide(db, i, req.params.action);
    if (r.changed) writeDB(db);
    if (r.error) return res.status(r.code).json({ error: r.error });
    if (r.confirmed) notifyConfirmed(db, i);
    res.json({ ok: true, interest: publicInterest(i) });
  });

  // ... or from the emailed link (no sign-in)
  app.get('/api/eoi/:token', eoiLimiter, (req, res) => {
    const db = readDB();
    if (lapseExpired(db)) writeDB(db);
    const i = (db.interests || []).find(x => x.confirmToken && x.confirmToken === req.params.token);
    if (!i) return res.status(404).json({ error: 'This link is not valid.' });
    res.json({ status: i.status, listingName: i.listingName, amount: i.amount, refCode: i.refCode, confirmBy: i.confirmBy });
  });
  app.post('/api/eoi/:token', eoiLimiter, (req, res) => {
    const db = readDB();
    const i = (db.interests || []).find(x => x.confirmToken && x.confirmToken === req.params.token);
    if (!i) return res.status(404).json({ error: 'This link is not valid.' });
    const action = req.body.action === 'confirm' ? 'confirm' : 'withdraw';
    const r = decide(db, i, action);
    if (r.changed) writeDB(db);
    if (r.error) return res.status(r.code).json({ error: r.error });
    if (r.confirmed) notifyConfirmed(db, i);
    res.json({ ok: true, status: i.status });
  });

  // Leads: developers see CONFIRMED interests on their own listings only; admins see everything; investors their own.
  app.get('/api/interests', requireAuth, (req, res) => {
    const db = readDB();
    if (lapseExpired(db)) writeDB(db);
    const user = db.users.find(u => u.id === req.session.userId);
    let list = db.interests || [];
    if (user.role === 'admin' || user.role === 'regulator') {
      // all
    } else if (user.role === 'developer') {
      const mine = new Set(db.listings.filter(l => l.devId === user.id).map(l => l.id));
      list = list.filter(i => mine.has(i.listingId) && i.status === 'confirmed');
    } else {
      list = list.filter(i => i.userId === user.id);
    }
    res.json(list.map(publicInterest));
  });

  // ── Capital Certainty (developer / admin) ──────────────────────
  function capitalCertainty(db, listing) {
    const all = (db.interests || []).filter(i => i.listingId === listing.id);
    const by = s => all.filter(i => i.status === s);
    const confirmed = by('confirmed');
    const confirmedAmount = confirmed.reduce((a, i) => a + (parseNum(i.amount) || 0), 0);
    const raise = parseNum(listing.raise) || 0;
    const coverage = raise ? round1(confirmedAmount / raise * 100) : 0;
    const decided = confirmed.length + by('withdrawn').length + by('lapsed').length;
    const confirmRate = decided ? confirmed.length / decided : 0;
    const score = Math.round(Math.min(100, 0.7 * Math.min(coverage, 100) + 0.3 * confirmRate * 100));

    let predictedClose = null, velocityNote = 'Needs at least two confirmed interests to estimate.';
    if (confirmed.length >= 2 && raise && confirmedAmount > 0) {
      const first = Math.min(...confirmed.map(i => new Date(i.confirmedAt || i.createdAt).getTime()));
      const days = Math.max(1, (Date.now() - first) / 86400000);
      const perDay = confirmedAmount / days;
      const remaining = Math.max(0, raise - confirmedAmount);
      if (remaining === 0) { predictedClose = new Date().toISOString(); velocityNote = 'Confirmed interest covers the raise.'; }
      else { predictedClose = new Date(Date.now() + (remaining / perDay) * 86400000).toISOString(); velocityNote = `At the current pace of about $${Math.round(perDay * 7).toLocaleString('en-AU')} confirmed per week.`; }
    }
    return {
      raise, pending: by('pending_confirmation').length, confirmed: confirmed.length, withdrawn: by('withdrawn').length, lapsed: by('lapsed').length,
      confirmedAmount, coveragePct: coverage, confirmationRatePct: Math.round(confirmRate * 100), score, predictedClose, velocityNote,
      definition: 'Score = 70% confirmed-interest coverage of the raise + 30% confirmation rate. Interest is not a commitment to invest.'
    };
  }

  app.get('/api/listings/:id/capital-certainty', requireAuth, (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.userId);
    const listing = db.listings.find(l => l.id === req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    if (!(user.role === 'admin' || user.role === 'regulator' || listing.devId === user.id)) return res.status(403).json({ error: 'Not your listing.' });
    if (lapseExpired(db)) writeDB(db);
    res.json(capitalCertainty(db, listing));
  });

  // Hourly sweep so lapses are recorded even if nobody looks.
  const sweep = () => { try { const db = readDB(); if (lapseExpired(db)) writeDB(db); } catch (e) { console.error('[EOI sweep]', e.message); } };
  setInterval(sweep, 60 * 60 * 1000);
  ctx.lapseExpiredEois = () => { const db = readDB(); if (lapseExpired(db)) writeDB(db); };
  ctx.capitalCertainty = capitalCertainty;
};
