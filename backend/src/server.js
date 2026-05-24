import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
      const safeExt = /^\.(jpe?g|png|webp|heic|heif)$/i.test(ext) ? ext : '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WEBP or HEIC images are allowed'));
  },
});

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

const societySchema = z.object({
  name: z.string().min(2),
  registration_number: z.string().optional().nullable(),
  address_line1: z.string().min(2),
  address_line2: z.string().optional().nullable(),
  area: z.string().min(2),
  city: z.string().default('Pimpri-Chinchwad'),
  pincode: z.string().regex(/^\d{6}$/),
  total_flats: z.coerce.number().int().positive().optional().nullable(),
  year_established: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional().nullable(),
  chairperson_name: z.string().optional().nullable(),
  secretary_name: z.string().optional().nullable(),
  treasurer_name: z.string().optional().nullable(),
  contact_email: z.string().email(),
  contact_phone: z.string().regex(/^[6-9]\d{9}$/),
});

const memberSchema = z.object({
  full_name: z.string().min(2),
  society_id: z.coerce.number().int().positive(),
  flat_number: z.string().min(1),
  wing: z.string().optional().nullable(),
  email: z.string().email(),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  role_in_society: z.enum(['resident', 'committee_member', 'chairperson', 'secretary', 'treasurer']).default('resident'),
  is_primary_resident: z.coerce.boolean().default(true),
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ===== Auth: OTP =====
const phoneRegex = /^[6-9]\d{9}$/;
const OTP_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEV_MODE = process.env.NODE_ENV !== 'production';

const requestOtpSchema = z.object({ phone: z.string().regex(phoneRegex) });
const verifyOtpSchema = z.object({
  phone: z.string().regex(phoneRegex),
  otp: z.string().regex(/^\d{6}$/),
});

function lookupUserByPhone(phone) {
  const member = db.prepare(`
    SELECT m.*, s.name AS society_name, s.area AS society_area
    FROM members m JOIN societies s ON s.id = m.society_id
    WHERE m.phone = ? ORDER BY m.created_at DESC LIMIT 1
  `).get(phone);

  let society = null;
  if (member) {
    society = db.prepare('SELECT * FROM societies WHERE id = ?').get(member.society_id);
  } else {
    society = db.prepare(
      'SELECT * FROM societies WHERE contact_phone = ? ORDER BY created_at DESC LIMIT 1'
    ).get(phone);
  }

  // Admin persona = registered society contact OR a member with an officer role
  const isSocietyContact = !!db
    .prepare('SELECT id FROM societies WHERE contact_phone = ? LIMIT 1')
    .get(phone);
  const isOfficer = !!(
    member && ['chairperson', 'secretary', 'treasurer'].includes(member.role_in_society)
  );
  const is_admin = isSocietyContact || isOfficer;
  const role = is_admin ? 'admin' : 'member';

  return { phone, member: member ?? null, society: society ?? null, is_admin, role };
}

app.post('/api/auth/request-otp', (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
  const { phone } = parsed.data;

  // Validate: phone must be registered — either as a member's mobile OR as a society's contact phone.
  const memberRow = db.prepare('SELECT id FROM members WHERE phone = ? LIMIT 1').get(phone);
  const societyRow = db.prepare('SELECT id FROM societies WHERE contact_phone = ? LIMIT 1').get(phone);
  if (!memberRow && !societyRow) {
    return res.status(404).json({
      error: 'The mobile number is not registered. Do you want to register your society?',
      not_registered: true,
    });
  }

  // throttle: max 3 OTPs per phone per 10 minutes
  const recent = db.prepare(`
    SELECT COUNT(*) AS c FROM auth_otps
    WHERE phone = ? AND created_at >= datetime('now', '-10 minutes')
  `).get(phone).c;
  if (recent >= 3) {
    return res.status(429).json({ error: 'Too many OTP requests. Try again in a few minutes.' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires_at = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();
  db.prepare('INSERT INTO auth_otps (phone, otp, expires_at) VALUES (?, ?, ?)').run(phone, otp, expires_at);

  console.log(`[OTP] phone=${phone} otp=${otp}`);
  res.json({
    sent: true,
    expires_in: OTP_TTL_SECONDS,
    // In dev we surface the OTP so the demo works without SMS infra.
    ...(DEV_MODE ? { dev_otp: otp } : {}),
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid 6-digit OTP.' });
  const { phone, otp } = parsed.data;

  const row = db.prepare(`
    SELECT * FROM auth_otps
    WHERE phone = ? AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(phone);
  if (!row) return res.status(400).json({ error: 'No active OTP. Please request a new one.' });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  if (row.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });

  db.prepare('UPDATE auth_otps SET consumed_at = datetime(\'now\') WHERE id = ?').run(row.id);

  const token = crypto.randomBytes(24).toString('hex');
  const expires_at = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, phone, expires_at) VALUES (?, ?, ?)').run(token, phone, expires_at);

  res.json({ token, user: lookupUserByPhone(phone) });
});

function authFromHeader(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return null;
  const token = m[1].trim();
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return session;
}

app.get('/api/auth/me', (req, res) => {
  const session = authFromHeader(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: lookupUserByPhone(session.phone) });
});

function requireAdmin(req, res) {
  const session = authFromHeader(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  const user = lookupUserByPhone(session.phone);
  if (!user.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}

app.post('/api/auth/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/);
  if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1].trim());
  res.json({ ok: true });
});

app.get('/api/societies', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM members m WHERE m.society_id = s.id) AS member_count
    FROM societies s
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows);
});

app.get('/api/societies/:id', (req, res) => {
  const society = db.prepare('SELECT * FROM societies WHERE id = ?').get(req.params.id);
  if (!society) return res.status(404).json({ error: 'Society not found' });
  const members = db.prepare('SELECT * FROM members WHERE society_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...society, members });
});

app.post('/api/societies/:id/renew', (req, res) => {
  const society = db.prepare('SELECT * FROM societies WHERE id = ?').get(req.params.id);
  if (!society) return res.status(404).json({ error: 'Society not found' });

  const amount = society.overdue_amount || 0;
  db.prepare(`
    UPDATE societies SET
      membership_end_date = date('now', '+365 days'),
      last_payment_date = date('now'),
      overdue_amount = 0
    WHERE id = ?
  `).run(req.params.id);

  // Create a receipt document for this renewal
  const thisYear = new Date().getFullYear();
  db.prepare(
    'INSERT INTO documents (society_id, type, name, issued_date) VALUES (?, ?, ?, ?)'
  ).run(
    req.params.id,
    'receipt',
    `Renewal Receipt FY ${thisYear}-${String(thisYear + 1).slice(2)} · ₹${amount.toLocaleString('en-IN')}`,
    new Date().toISOString().slice(0, 10),
  );

  const updated = db.prepare('SELECT * FROM societies WHERE id = ?').get(req.params.id);
  res.json({ ok: true, society: updated, paid: amount });
});

app.get('/api/societies/:id/profile', (req, res) => {
  const society = db.prepare('SELECT * FROM societies WHERE id = ?').get(req.params.id);
  if (!society) return res.status(404).json({ error: 'Society not found' });

  const documents = db.prepare(
    'SELECT * FROM documents WHERE society_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  const vent_issues = db.prepare(`
    SELECT id, category, title, description, severity, photo_path, status, created_at
    FROM vent_issues WHERE society_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(req.params.id);

  res.json({
    society,
    documents,
    vent_timeline: { issues: vent_issues },
  });
});

app.post('/api/societies', (req, res) => {
  const parsed = societySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  }
  const d = parsed.data;
  try {
    const stmt = db.prepare(`
      INSERT INTO societies (
        name, registration_number, address_line1, address_line2, area, city, pincode,
        total_flats, year_established, chairperson_name, secretary_name, treasurer_name,
        contact_email, contact_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      d.name, d.registration_number ?? null, d.address_line1, d.address_line2 ?? null,
      d.area, d.city, d.pincode, d.total_flats ?? null, d.year_established ?? null,
      d.chairperson_name ?? null, d.secretary_name ?? null, d.treasurer_name ?? null,
      d.contact_email, d.contact_phone
    );
    const newId = info.lastInsertRowid;

    // Seed default membership: 1-year validity from today, no overdue, fresh payment
    db.prepare(`
      UPDATE societies
      SET membership_end_date = date('now', '+365 days'),
          last_payment_date = date('now'),
          overdue_amount = 0,
          convenience_stores = COALESCE(convenience_stores, 0)
      WHERE id = ?
    `).run(newId);

    // Seed initial documents (share certificate + first receipt)
    const docIns = db.prepare(
      'INSERT INTO documents (society_id, type, name, issued_date) VALUES (?, ?, ?, ?)'
    );
    const issued = d.year_established ? `${d.year_established}-04-15` : new Date().toISOString().slice(0, 10);
    docIns.run(newId, 'share_certificate', 'Share Certificate', issued);
    const thisYear = new Date().getFullYear();
    docIns.run(newId, 'receipt', `Membership Receipt FY ${thisYear}-${String(thisYear + 1).slice(2)}`, new Date().toISOString().slice(0, 10));

    const created = db.prepare('SELECT * FROM societies WHERE id = ?').get(newId);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A society with this registration number already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/members', (req, res) => {
  const { society_id } = req.query;
  let rows;
  if (society_id) {
    rows = db.prepare(`
      SELECT m.*, s.name AS society_name FROM members m
      JOIN societies s ON s.id = m.society_id
      WHERE m.society_id = ?
      ORDER BY m.created_at DESC
    `).all(society_id);
  } else {
    rows = db.prepare(`
      SELECT m.*, s.name AS society_name FROM members m
      JOIN societies s ON s.id = m.society_id
      ORDER BY m.created_at DESC
    `).all();
  }
  res.json(rows);
});

app.post('/api/members', (req, res) => {
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  }
  const d = parsed.data;
  const society = db.prepare('SELECT id FROM societies WHERE id = ?').get(d.society_id);
  if (!society) return res.status(400).json({ error: 'Selected society does not exist' });
  const stmt = db.prepare(`
    INSERT INTO members (
      full_name, society_id, flat_number, wing, email, phone,
      date_of_birth, gender, role_in_society, is_primary_resident
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    d.full_name, d.society_id, d.flat_number, d.wing ?? null,
    d.email, d.phone, d.date_of_birth ?? null, d.gender ?? null,
    d.role_in_society, d.is_primary_resident ? 1 : 0
  );
  const created = db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

app.get('/api/stats', (_req, res) => {
  const society_count = db.prepare('SELECT COUNT(*) AS c FROM societies').get().c;
  const member_count = db.prepare('SELECT COUNT(*) AS c FROM members').get().c;
  const areas = db.prepare('SELECT area, COUNT(*) AS c FROM societies GROUP BY area ORDER BY c DESC').all();
  res.json({ society_count, member_count, areas });
});

// ===== VENT: Civic issues =====
const handleRegex = /^@?[A-Za-z0-9._-]{1,30}$/;
const issueSchema = z.object({
  society_id: z.coerce.number().int().positive(),
  reporter_name: z.string().min(2),
  category: z.enum(['road', 'water', 'sewage', 'streetlight', 'electricity', 'safety', 'noise', 'encroachment', 'other']),
  title: z.string().min(3),
  description: z.string().min(5),
  location: z.string().optional().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  instagram_handle: z.string().regex(handleRegex).optional().nullable(),
  x_handle: z.string().regex(handleRegex).optional().nullable(),
  facebook_handle: z.string().regex(handleRegex).optional().nullable(),
  civic_tags: z.union([z.array(z.string()), z.string()]).optional().nullable(),
});

function stripAt(handle) {
  if (!handle) return null;
  const h = String(handle).trim();
  return h.startsWith('@') ? h.slice(1) : h;
}

app.post('/api/vent/issues', upload.single('photo'), (req, res) => {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  }
  const d = parsed.data;
  const society = db.prepare('SELECT id FROM societies WHERE id = ?').get(d.society_id);
  if (!society) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Selected society does not exist' });
  }
  const photo_path = req.file ? `/uploads/${req.file.filename}` : null;
  // civic_tags may arrive as array, JSON string, or comma-separated string
  let civicTags = [];
  if (Array.isArray(d.civic_tags)) civicTags = d.civic_tags;
  else if (typeof d.civic_tags === 'string' && d.civic_tags.length) {
    try { const parsed = JSON.parse(d.civic_tags); if (Array.isArray(parsed)) civicTags = parsed; }
    catch { civicTags = d.civic_tags.split(',').map((s) => s.trim()).filter(Boolean); }
  }
  civicTags = civicTags.map((s) => String(s).trim()).filter(Boolean).slice(0, 12);

  const stmt = db.prepare(`
    INSERT INTO vent_issues (
      society_id, reporter_name, category, title, description, location, severity, photo_path,
      instagram_handle, x_handle, facebook_handle, civic_tags, last_activity_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(
    d.society_id, d.reporter_name, d.category, d.title, d.description, d.location ?? null, d.severity, photo_path,
    stripAt(d.instagram_handle), stripAt(d.x_handle), stripAt(d.facebook_handle),
    JSON.stringify(civicTags)
  );
  const created = db.prepare('SELECT * FROM vent_issues WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

// Helper: bump last_activity_at whenever someone interacts with a post
function bumpActivity(issueId) {
  db.prepare(`UPDATE vent_issues SET last_activity_at = datetime('now') WHERE id = ?`).run(issueId);
}

// Sweep stale posts (no activity for 7 days). Called before listing.
function sweepStaleVentPosts() {
  db.prepare(
    `DELETE FROM vent_issues WHERE COALESCE(last_activity_at, created_at) < datetime('now', '-7 days')`
  ).run();
}

app.get('/api/vent/issues', (req, res) => {
  // Drop any posts with no activity for over 7 days before responding
  sweepStaleVentPosts();

  const { society_id, category, status } = req.query;
  const where = [];
  const params = [];
  if (society_id) { where.push('i.society_id = ?'); params.push(society_id); }
  if (category) { where.push('i.category = ?'); params.push(category); }
  if (status) { where.push('i.status = ?'); params.push(status); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT i.*, s.name AS society_name, s.area
    FROM vent_issues i
    JOIN societies s ON s.id = i.society_id
    ${whereSql}
    ORDER BY i.created_at DESC
    LIMIT 200
  `).all(...params);

  const commentStmt = db.prepare('SELECT * FROM vent_comments WHERE vent_issue_id = ? ORDER BY created_at ASC');
  const followupStmt = db.prepare('SELECT * FROM vent_followups WHERE vent_issue_id = ? ORDER BY created_at ASC');
  const out = rows.map((r) => ({
    ...r,
    civic_tags: safeJsonArray(r.civic_tags),
    comments: commentStmt.all(r.id),
    followups: followupStmt.all(r.id),
  }));
  res.json(out);
});

function safeJsonArray(s) {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Like / dislike — increments, no per-user tracking (sufficient for prototype).
// Undo endpoints decrement (clamped to 0) for the same anonymous semantics.
function bumpCount(id, column, delta) {
  db.prepare(`UPDATE vent_issues SET ${column} = MAX(0, COALESCE(${column}, 0) + ?) WHERE id = ?`).run(delta, id);
}
app.post('/api/vent/issues/:id/like', (req, res) => {
  const exists = db.prepare('SELECT id FROM vent_issues WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Issue not found' });
  bumpCount(req.params.id, 'likes_count', 1);
  bumpActivity(req.params.id);
  res.json(db.prepare('SELECT id, likes_count, dislikes_count FROM vent_issues WHERE id = ?').get(req.params.id));
});
app.post('/api/vent/issues/:id/unlike', (req, res) => {
  const exists = db.prepare('SELECT id FROM vent_issues WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Issue not found' });
  bumpCount(req.params.id, 'likes_count', -1);
  bumpActivity(req.params.id);
  res.json(db.prepare('SELECT id, likes_count, dislikes_count FROM vent_issues WHERE id = ?').get(req.params.id));
});
app.post('/api/vent/issues/:id/dislike', (req, res) => {
  const exists = db.prepare('SELECT id FROM vent_issues WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Issue not found' });
  bumpCount(req.params.id, 'dislikes_count', 1);
  bumpActivity(req.params.id);
  res.json(db.prepare('SELECT id, likes_count, dislikes_count FROM vent_issues WHERE id = ?').get(req.params.id));
});
app.post('/api/vent/issues/:id/undislike', (req, res) => {
  const exists = db.prepare('SELECT id FROM vent_issues WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Issue not found' });
  bumpCount(req.params.id, 'dislikes_count', -1);
  bumpActivity(req.params.id);
  res.json(db.prepare('SELECT id, likes_count, dislikes_count FROM vent_issues WHERE id = ?').get(req.params.id));
});

// Comments
const commentSchema = z.object({
  author_name: z.string().min(2),
  body: z.string().min(1).max(500),
  society: z.string().max(120).optional().nullable(),
});
app.post('/api/vent/issues/:id/comments', (req, res) => {
  const exists = db.prepare('SELECT id FROM vent_issues WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Issue not found' });
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  const d = parsed.data;
  const info = db.prepare(
    'INSERT INTO vent_comments (vent_issue_id, author_name, body, society) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, d.author_name.trim(), d.body.trim(), d.society?.trim() || null);
  bumpActivity(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM vent_comments WHERE id = ?').get(info.lastInsertRowid));
});

// Follow-ups (added by the original post creator to track resolution progress)
const followupSchema = z.object({ body: z.string().min(1).max(500) });
app.post('/api/vent/issues/:id/followups', (req, res) => {
  const exists = db.prepare('SELECT id FROM vent_issues WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Issue not found' });
  const parsed = followupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  const info = db.prepare('INSERT INTO vent_followups (vent_issue_id, body) VALUES (?, ?)')
    .run(req.params.id, parsed.data.body.trim());
  bumpActivity(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM vent_followups WHERE id = ?').get(info.lastInsertRowid));
});

// Status update (resolution tracking)
const statusSchema = z.object({ status: z.enum(['open', 'in_progress', 'resolved']) });
app.patch('/api/vent/issues/:id/status', (req, res) => {
  const exists = db.prepare('SELECT id FROM vent_issues WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Issue not found' });
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  db.prepare('UPDATE vent_issues SET status = ? WHERE id = ?').run(parsed.data.status, req.params.id);
  bumpActivity(req.params.id);
  res.json(db.prepare('SELECT id, status FROM vent_issues WHERE id = ?').get(req.params.id));
});

app.get('/api/vent/stats', (req, res) => {
  const { society_id } = req.query;
  const params = society_id ? [society_id] : [];
  const sFilter = society_id ? 'WHERE society_id = ?' : '';

  const issues_total = db.prepare(`SELECT COUNT(*) AS c FROM vent_issues ${sFilter}`).get(...params).c;
  const issues_open = db.prepare(`SELECT COUNT(*) AS c FROM vent_issues ${sFilter} ${sFilter ? "AND status = 'open'" : "WHERE status = 'open'"}`).get(...params).c;
  const issues_by_category = db.prepare(`
    SELECT category, COUNT(*) AS c FROM vent_issues ${sFilter}
    GROUP BY category ORDER BY c DESC
  `).all(...params);

  res.json({
    issues_total,
    issues_open,
    issues_by_category,
  });
});

// ===== Member-side: submit a change request to your society =====
// Members request edits to their own society's profile (status is not editable here).
// Admins get to apply the change via the Accept Changes flow.
const memberChangeSchema = z.object({
  name: z.string().min(2).optional(),
  registration_number: z.string().optional().nullable(),
  address_line1: z.string().min(2).optional(),
  address_line2: z.string().optional().nullable(),
  area: z.string().min(2).optional(),
  city: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  total_flats: z.coerce.number().int().positive().optional().nullable(),
  convenience_stores: z.coerce.number().int().nonnegative().optional().nullable(),
  year_established: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional().nullable(),
  chairperson_name: z.string().optional().nullable(),
  secretary_name: z.string().optional().nullable(),
  treasurer_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
});

app.post('/api/societies/:id/change-requests', (req, res) => {
  const session = authFromHeader(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const society = db.prepare('SELECT * FROM societies WHERE id = ?').get(req.params.id);
  if (!society) return res.status(404).json({ error: 'Society not found' });

  // Authorization: caller must belong to this society (as member or contact), OR be admin
  const user = lookupUserByPhone(session.phone);
  const ownsThis =
    user.is_admin ||
    (user.member && user.member.society_id === Number(req.params.id)) ||
    (user.society && user.society.id === Number(req.params.id));
  if (!ownsThis) {
    return res.status(403).json({ error: 'You can only request changes for your own society' });
  }

  const parsed = memberChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  }
  const d = parsed.data;

  // Only keep keys that actually differ from the current society value
  const diff = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue;
    const cur = society[k];
    if ((cur ?? null) !== (v ?? null)) diff[k] = v;
  }
  if (Object.keys(diff).length === 0) {
    return res.status(400).json({ error: 'No changes detected — values match the current profile.' });
  }

  const info = db.prepare(`
    INSERT INTO society_change_requests (society_id, requested_by_phone, payload, status)
    VALUES (?, ?, ?, 'pending')
  `).run(req.params.id, session.phone, JSON.stringify(diff));
  const created = db.prepare('SELECT * FROM society_change_requests WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...created, payload: JSON.parse(created.payload) });
});

// ===== Admin endpoints =====

// List all societies with member_count + pending_changes_count
app.get('/api/admin/societies', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM members m WHERE m.society_id = s.id) AS member_count,
      (SELECT COUNT(*) FROM society_change_requests scr
        WHERE scr.society_id = s.id AND scr.status = 'pending') AS pending_changes_count
    FROM societies s
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows);
});

// Patch any updatable field on a society
const societyUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  registration_number: z.string().optional().nullable(),
  address_line1: z.string().min(2).optional(),
  address_line2: z.string().optional().nullable(),
  area: z.string().min(2).optional(),
  city: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  total_flats: z.coerce.number().int().positive().optional().nullable(),
  convenience_stores: z.coerce.number().int().nonnegative().optional().nullable(),
  year_established: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional().nullable(),
  chairperson_name: z.string().optional().nullable(),
  secretary_name: z.string().optional().nullable(),
  treasurer_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  status: z.enum(['pending', 'active', 'inactive']).optional(),
});

app.patch('/api/admin/societies/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const society = db.prepare('SELECT * FROM societies WHERE id = ?').get(req.params.id);
  if (!society) return res.status(404).json({ error: 'Society not found' });

  const parsed = societyUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  }
  const d = parsed.data;
  const entries = Object.entries(d).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return res.json(society);

  const setSql = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  try {
    db.prepare(`UPDATE societies SET ${setSql} WHERE id = ?`).run(...values, req.params.id);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A society with this registration number already exists' });
    }
    throw err;
  }
  const updated = db.prepare('SELECT * FROM societies WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// List change requests for a society
app.get('/api/admin/societies/:id/change-requests', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = req.query.status || 'pending';
  const rows = db.prepare(`
    SELECT * FROM society_change_requests
    WHERE society_id = ? AND status = ?
    ORDER BY created_at DESC
  `).all(req.params.id, status);
  res.json(rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) })));
});

// Accept a change request — applies the payload to the society
app.post('/api/admin/change-requests/:id/accept', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const scr = db.prepare('SELECT * FROM society_change_requests WHERE id = ?').get(req.params.id);
  if (!scr) return res.status(404).json({ error: 'Change request not found' });
  if (scr.status !== 'pending') {
    return res.status(409).json({ error: `Change request already ${scr.status}` });
  }

  const payload = JSON.parse(scr.payload);
  const parsed = societyUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Stored change payload is invalid', issues: parsed.error.issues });
  }
  const d = parsed.data;
  const entries = Object.entries(d).filter(([, v]) => v !== undefined);
  if (entries.length > 0) {
    const setSql = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    db.prepare(`UPDATE societies SET ${setSql} WHERE id = ?`).run(...values, scr.society_id);
  }
  db.prepare(`
    UPDATE society_change_requests
    SET status = 'accepted', decided_at = datetime('now'), decided_by_phone = ?
    WHERE id = ?
  `).run(admin.phone, req.params.id);

  const society = db.prepare('SELECT * FROM societies WHERE id = ?').get(scr.society_id);
  res.json({ ok: true, society });
});

// ===== Notices & circulars =====
const NOTICE_TYPES = ['Information', 'GR', 'Policy'];

function noticeWithSocieties(notice) {
  if (!notice) return notice;
  const socs = notice.applies_to_all
    ? []
    : db.prepare('SELECT society_id FROM notice_societies WHERE notice_id = ?').all(notice.id).map((r) => r.society_id);
  return { ...notice, society_ids: socs };
}

app.get('/api/admin/notices', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { from, to, year } = req.query;
  const where = [];
  const params = [];

  // Hard rule: never look back more than 2 years
  const minYear = new Date().getFullYear() - 2;
  const minDate = `${minYear}-01-01`;
  where.push('date(notice_date) >= date(?)');
  params.push(minDate);

  if (from) { where.push('date(notice_date) >= date(?)'); params.push(from); }
  if (to)   { where.push('date(notice_date) <= date(?)'); params.push(to); }
  if (year && !from && !to) {
    where.push(`strftime('%Y', notice_date) = ?`);
    params.push(String(year));
  }
  // Default scope when nothing else given: current year
  if (!from && !to && !year) {
    where.push(`strftime('%Y', notice_date) = ?`);
    params.push(String(new Date().getFullYear()));
  }

  const sql = `SELECT * FROM notices WHERE ${where.join(' AND ')} ORDER BY notice_date DESC, created_at DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(noticeWithSocieties));
});

app.get('/api/admin/notices/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const row = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Notice not found' });
  res.json(noticeWithSocieties(row));
});

function parseNoticeBody(body) {
  // multipart fields arrive as strings — coerce a few of them
  const subject = String(body.subject || '').trim();
  const content = String(body.content || '').trim();
  const notice_date = String(body.notice_date || '').trim();
  const notice_type = String(body.notice_type || 'Information').trim();
  const applies_to_all = body.applies_to_all === '1' || body.applies_to_all === true || body.applies_to_all === 'true' ? 1 : 0;
  let society_ids = [];
  if (!applies_to_all) {
    const raw = body.society_ids;
    if (Array.isArray(raw)) society_ids = raw;
    else if (typeof raw === 'string' && raw.length) society_ids = raw.split(',');
    society_ids = society_ids.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
  }

  const errors = [];
  if (subject.length < 2) errors.push({ path: ['subject'], message: 'Subject is required.' });
  if (content.length < 2) errors.push({ path: ['content'], message: 'Content is required.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(notice_date)) errors.push({ path: ['notice_date'], message: 'Valid date is required.' });
  if (!NOTICE_TYPES.includes(notice_type)) errors.push({ path: ['notice_type'], message: 'Pick Information / GR / Policy.' });
  if (!applies_to_all && society_ids.length === 0) errors.push({ path: ['society_ids'], message: 'Pick at least one society or choose "All societies".' });

  return { ok: errors.length === 0, errors, data: { subject, content, notice_date, notice_type, applies_to_all, society_ids } };
}

app.post('/api/admin/notices', upload.single('attachment'), (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) { if (req.file) fs.unlink(req.file.path, () => {}); return; }

  const parsed = parseNoticeBody(req.body);
  if (!parsed.ok) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Validation failed', issues: parsed.errors });
  }
  const d = parsed.data;
  const attachment_path = req.file ? `/uploads/${req.file.filename}` : null;

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO notices (subject, content, notice_date, notice_type, applies_to_all, attachment_path, created_by_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(d.subject, d.content, d.notice_date, d.notice_type, d.applies_to_all, attachment_path, admin.phone);
    const id = info.lastInsertRowid;
    if (!d.applies_to_all) {
      const ins = db.prepare('INSERT INTO notice_societies (notice_id, society_id) VALUES (?, ?)');
      d.society_ids.forEach((sid) => ins.run(id, sid));
    }
    return id;
  });
  const id = tx();
  res.status(201).json(noticeWithSocieties(db.prepare('SELECT * FROM notices WHERE id = ?').get(id)));
});

app.patch('/api/admin/notices/:id', upload.single('attachment'), (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) { if (req.file) fs.unlink(req.file.path, () => {}); return; }

  const existing = db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id);
  if (!existing) { if (req.file) fs.unlink(req.file.path, () => {}); return res.status(404).json({ error: 'Notice not found' }); }

  const parsed = parseNoticeBody(req.body);
  if (!parsed.ok) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Validation failed', issues: parsed.errors });
  }
  const d = parsed.data;
  const attachment_path = req.file ? `/uploads/${req.file.filename}` : existing.attachment_path;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE notices SET subject = ?, content = ?, notice_date = ?, notice_type = ?,
        applies_to_all = ?, attachment_path = ?, edited_at = datetime('now')
      WHERE id = ?
    `).run(d.subject, d.content, d.notice_date, d.notice_type, d.applies_to_all, attachment_path, req.params.id);
    db.prepare('DELETE FROM notice_societies WHERE notice_id = ?').run(req.params.id);
    if (!d.applies_to_all) {
      const ins = db.prepare('INSERT INTO notice_societies (notice_id, society_id) VALUES (?, ?)');
      d.society_ids.forEach((sid) => ins.run(req.params.id, sid));
    }
  });
  tx();
  res.json(noticeWithSocieties(db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id)));
});

// ===== Invoices (admin-issued, billed to a society) =====
const invoiceSchema = z.object({
  society_id: z.coerce.number().int().positive(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_inr: z.coerce.number().int().positive(),
  amount_in_words: z.string().min(3),
}).refine((d) => d.from_date <= d.to_date, {
  message: 'From date must be on or before To date',
  path: ['to_date'],
});

function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM invoices WHERE invoice_number LIKE ?`
  ).get(`INV-${year}-%`);
  const next = String(row.c + 1).padStart(4, '0');
  return `INV-${year}-${next}`;
}

app.get('/api/admin/invoices', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT i.*, s.name AS society_name, s.area AS society_area
    FROM invoices i JOIN societies s ON s.id = i.society_id
    ORDER BY i.created_at DESC
  `).all();
  res.json(rows);
});

app.post('/api/admin/invoices', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  }
  const d = parsed.data;
  const society = db.prepare('SELECT id, name FROM societies WHERE id = ?').get(d.society_id);
  if (!society) return res.status(400).json({ error: 'Selected society does not exist' });

  const invoice_number = nextInvoiceNumber();
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      society_id, invoice_number, from_date, to_date,
      amount_inr, amount_in_words, created_by_phone
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDoc = db.prepare(`
    INSERT INTO documents (society_id, type, name, issued_date)
    VALUES (?, 'invoice', ?, ?)
  `);

  const tx = db.transaction(() => {
    const info = insertInvoice.run(
      d.society_id, invoice_number, d.from_date, d.to_date,
      d.amount_inr, d.amount_in_words, admin.phone
    );
    const docName = `Invoice ${invoice_number} · ₹${d.amount_inr.toLocaleString('en-IN')} · ${d.from_date} → ${d.to_date}`;
    insertDoc.run(d.society_id, docName, new Date().toISOString().slice(0, 10));
    return info.lastInsertRowid;
  });
  const id = tx();
  const created = db.prepare(`
    SELECT i.*, s.name AS society_name, s.area AS society_area
    FROM invoices i JOIN societies s ON s.id = i.society_id
    WHERE i.id = ?
  `).get(id);
  res.status(201).json(created);
});

// ===== Federation committee (single, federation-wide) =====
const committeeUpdateSchema = z.object({
  salutation: z.enum(['Shri.', 'Smt.']).optional(),
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  term_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  term_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

app.get('/api/admin/federation/committee', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(
    'SELECT * FROM federation_committee ORDER BY position ASC'
  ).all();
  res.json(rows);
});

app.patch('/api/admin/federation/committee/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const row = db.prepare('SELECT * FROM federation_committee WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Committee member not found' });

  const parsed = committeeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
  }
  const d = parsed.data;
  const entries = Object.entries(d).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return res.json(row);

  const setSql = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  db.prepare(`UPDATE federation_committee SET ${setSql} WHERE id = ?`).run(...values, req.params.id);

  const updated = db.prepare('SELECT * FROM federation_committee WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Reject a change request
app.post('/api/admin/change-requests/:id/reject', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const scr = db.prepare('SELECT * FROM society_change_requests WHERE id = ?').get(req.params.id);
  if (!scr) return res.status(404).json({ error: 'Change request not found' });
  if (scr.status !== 'pending') {
    return res.status(409).json({ error: `Change request already ${scr.status}` });
  }
  db.prepare(`
    UPDATE society_change_requests
    SET status = 'rejected', decided_at = datetime('now'), decided_by_phone = ?
    WHERE id = ?
  `).run(admin.phone, req.params.id);
  res.json({ ok: true });
});

// multer error handler
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`PCMC Federation Portal API listening on http://localhost:${port}`);
});
