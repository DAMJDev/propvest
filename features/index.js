// Feature modules are registered against the shared Express app.
// Each module receives the same context object (db access, auth guards, email, helpers).
module.exports = function registerFeatures(app, ctx) {
  // Shared upload helper: PDF/JPG/PNG up to 10MB, stored in the uploads directory.
  const uploader = prefix => ctx.multer({
    storage: ctx.multer.diskStorage({
      destination: (req, file, cb) => cb(null, ctx.UPLOAD_DIR),
      filename: (req, file, cb) => cb(null, `${prefix}-${Date.now()}-${ctx.crypto.randomBytes(4).toString('hex')}${ctx.path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = ['.pdf', '.jpg', '.jpeg', '.png'].includes(ctx.path.extname(file.originalname).toLowerCase());
      ok ? cb(null, true) : cb(new Error('Only PDF, JPG, or PNG files are accepted.'));
    }
  });
  ctx.upload = (prefix, ...fields) => {
    const mw = fields.length === 1 ? uploader(prefix).single(fields[0]) : uploader(prefix).fields(fields.map(name => ({ name, maxCount: 1 })));
    return (req, res, next) => mw(req, res, err => err ? res.status(400).json({ error: err.message }) : next());
  };
  ctx.removeFile = name => { if (name) ctx.fs.unlink(ctx.path.join(ctx.UPLOAD_DIR, name), () => {}); };
  ctx.sendUpload = (res, name, downloadName) => {
    const p = ctx.path.join(ctx.UPLOAD_DIR, String(name || ''));
    if (!name || !ctx.fs.existsSync(p)) return res.status(404).json({ error: 'File not found.' });
    res.download(p, downloadName || name);
  };
  ctx.audit = (db, entry) => { if (!db.auditLog) db.auditLog = []; db.auditLog.push({ at: new Date().toISOString(), ...entry }); };

  require('./interests')(app, ctx);
  require('./feaso')(app, ctx);
  require('./deal')(app, ctx);
  require('./tiers')(app, ctx);
  require('./contractors')(app, ctx);
  require('./drawdown')(app, ctx);
  require('./directory')(app, ctx);
};
