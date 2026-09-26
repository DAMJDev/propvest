// Investor verification tiers 3 and 4: proof of funds (admin verified) and PDD endorsement (admin granted).
// Tier 1 = registered, Tier 2 = wholesale certificate approved, Tier 3 = funds verified, Tier 4 = endorsed.
module.exports = function (app, ctx) {
  const { readDB, writeDB, requireAuth, requireAdmin, sendEmail, esc, BASE_URL, investorTier } = ctx;

  const PROOF_TYPES = [
    'Bank / brokerage account statement (last 90 days)', 'SMSF trustee balance statement', 'Mortgage offset account statement',
    'Term deposit certificate', "Solicitor's trust account confirmation letter", 'Line of credit / facility approval letter',
    'Share portfolio statement', 'Other — described in notes'
  ];
  const VALID_MONTHS = 6;

  app.get('/api/proof-of-funds/types', (req, res) => res.json({ types: PROOF_TYPES }));

  app.post('/api/proof-of-funds', requireAuth, ctx.upload('funds', 'fundsFile'), (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.userId);
    const drop = (code, error) => { if (req.file) ctx.removeFile(req.file.filename); return res.status(code).json({ error }); };
    if (user.role !== 'investor') return drop(403, 'Only investor accounts can submit proof of funds.');
    if (investorTier(user) === 'registered') return drop(400, 'Complete wholesale verification (Tier 2) first.');
    if (!req.file) return drop(400, 'Attach your statement or letter (PDF, JPG or PNG).');
    const proofType = String(req.body.proofType || '');
    if (!PROOF_TYPES.includes(proofType)) return drop(400, 'Choose the type of document you are providing.');
    if (!db.fundsProofs) db.fundsProofs = [];
    if (db.fundsProofs.find(p => p.userId === user.id && p.status === 'pending')) return drop(400, 'You already have proof of funds awaiting review.');
    const proof = {
      id: 'pf-' + Date.now(), userId: user.id, userEmail: user.email, userName: (user.fname + ' ' + (user.lname || '')).trim(),
      proofType, note: String(req.body.note || '').slice(0, 500), fileName: req.file.originalname, filePath: req.file.filename,
      status: 'pending', submittedAt: new Date().toISOString(), reviewedAt: null, reviewedBy: null, adminNotes: ''
    };
    db.fundsProofs.push(proof);
    const idx = db.users.findIndex(u => u.id === user.id);
    db.users[idx].fundsStatus = 'pending';
    writeDB(db);
    sendEmail(ctx.ADMIN_EMAIL, `Proof of funds to review: ${proof.userName}`, `<p style="color:#888">${esc(proof.userName)} (${esc(proof.userEmail)}) submitted <strong style="color:#c9a84c">${esc(proofType)}</strong> for Tier 3 verification.</p>`);
    res.json({ ok: true, proof: { ...proof, filePath: undefined } });
  });

  app.get('/api/proof-of-funds/status', requireAuth, (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.userId);
    const latest = (db.fundsProofs || []).filter(p => p.userId === user.id).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;
    res.json({ tier: investorTier(user), fundsStatus: user.fundsStatus || 'none', fundsExpiresAt: user.fundsExpiresAt || null, endorsed: !!user.endorsed, proof: latest ? { ...latest, filePath: undefined } : null });
  });

  app.get('/api/admin/funds-proofs', requireAdmin, (req, res) => {
    const db = readDB();
    res.json({ proofs: (db.fundsProofs || []).slice().reverse().map(p => ({ ...p, filePath: undefined })) });
  });

  app.get('/api/admin/funds-proofs/:id/download', requireAdmin, (req, res) => {
    const db = readDB();
    const p = (db.fundsProofs || []).find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    ctx.sendUpload(res, p.filePath, p.fileName);
  });

  app.post('/api/admin/funds-proofs/:id/:decision(approve|reject)', requireAdmin, (req, res) => {
    const db = readDB();
    const p = (db.fundsProofs || []).find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    if (p.status !== 'pending') return res.status(400).json({ error: 'Already reviewed.' });
    const approve = req.params.decision === 'approve';
    p.status = approve ? 'verified' : 'rejected';
    p.reviewedAt = new Date().toISOString();
    p.reviewedBy = req.session.userId;
    p.adminNotes = String(req.body.notes || '').slice(0, 500);
    const u = db.users.find(x => x.id === p.userId);
    if (u) {
      u.fundsStatus = p.status;
      u.fundsVerifiedAt = approve ? p.reviewedAt : null;
      u.fundsExpiresAt = approve ? new Date(Date.now() + VALID_MONTHS * 30.44 * 86400000).toISOString() : null;
    }
    ctx.audit(db, { by: req.session.userId, action: `funds_${p.status}`, userId: p.userId });
    writeDB(db);
    if (u) sendEmail(u.email, approve ? 'Proof of funds verified — Tier 3' : 'Proof of funds not accepted', approve
      ? `<p style="color:#888">Your proof of funds has been verified. You are now <strong style="color:#c9a84c">Tier 3 — Capital Ready</strong> until ${new Date(u.fundsExpiresAt).toLocaleDateString('en-AU')}.</p><a href="${BASE_URL}" style="display:inline-block;margin-top:16px;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Go to your account →</a>`
      : `<p style="color:#888">Your proof of funds could not be accepted.${p.adminNotes ? ' Reason: ' + esc(p.adminNotes) : ''} You can submit a new document from your account.</p>`);
    res.json({ ok: true, proof: { ...p, filePath: undefined } });
  });

  // Investors with their computed tier, for the admin console
  app.get('/api/admin/investors', requireAdmin, (req, res) => {
    const db = readDB();
    res.json({
      investors: db.users.filter(u => u.role === 'investor').map(u => ({
        id: u.id, name: (u.fname + ' ' + (u.lname || '')).trim(), email: u.email, tier: investorTier(u),
        wholesaleStatus: u.wholesaleStatus || 'none', fundsStatus: u.fundsStatus || 'none', endorsed: !!u.endorsed,
        educationCompletedAt: u.educationCompletedAt || null, joined: u.joined
      }))
    });
  });

  // Tier 4: endorsed by the platform. Requires Tier 3 first.
  app.post('/api/admin/users/:id/endorse', requireAdmin, (req, res) => {
    const db = readDB();
    const u = db.users.find(x => x.id === req.params.id && x.role === 'investor');
    if (!u) return res.status(404).json({ error: 'Investor not found.' });
    const endorse = req.body.endorsed !== false;
    if (endorse && investorTier({ ...u, endorsed: true }) !== 'prequalified') {
      return res.status(400).json({ error: 'The investor must have Tier 2 and Tier 3 verification current before endorsement.' });
    }
    u.endorsed = endorse;
    u.endorsedAt = endorse ? new Date().toISOString() : null;
    u.endorsedNote = endorse ? String(req.body.note || '').slice(0, 300) : '';
    ctx.audit(db, { by: req.session.userId, action: endorse ? 'endorsed' : 'endorsement_removed', userId: u.id });
    writeDB(db);
    res.json({ ok: true, tier: investorTier(u) });
  });
};
