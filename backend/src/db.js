import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'portal.db');

import fs from 'node:fs';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS societies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    registration_number TEXT UNIQUE,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    area TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Pimpri-Chinchwad',
    pincode TEXT NOT NULL,
    total_flats INTEGER,
    year_established INTEGER,
    chairperson_name TEXT,
    secretary_name TEXT,
    treasurer_name TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    society_id INTEGER NOT NULL,
    flat_number TEXT NOT NULL,
    wing TEXT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    date_of_birth TEXT,
    gender TEXT,
    role_in_society TEXT NOT NULL DEFAULT 'resident',
    is_primary_resident INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_members_society ON members(society_id);

  CREATE TABLE IF NOT EXISTS vent_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    society_id INTEGER NOT NULL,
    reporter_name TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT,
    severity TEXT NOT NULL DEFAULT 'medium',
    photo_path TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_vent_issues_society ON vent_issues(society_id);

  CREATE TABLE IF NOT EXISTS auth_otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_otps_phone ON auth_otps(phone, created_at DESC);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_phone ON sessions(phone);

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    society_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT,
    issued_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_documents_society ON documents(society_id);

  CREATE TABLE IF NOT EXISTS society_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    society_id INTEGER NOT NULL,
    requested_by_phone TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    decided_by_phone TEXT,
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_scr_society_status ON society_change_requests(society_id, status);

  CREATE TABLE IF NOT EXISTS committee_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    society_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    salutation TEXT NOT NULL DEFAULT 'Shri.',
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    term_start TEXT,
    term_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
    UNIQUE (society_id, position)
  );
  CREATE INDEX IF NOT EXISTS idx_committee_society ON committee_members(society_id, position);

  CREATE TABLE IF NOT EXISTS federation_committee (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position INTEGER NOT NULL UNIQUE,
    salutation TEXT NOT NULL DEFAULT 'Shri.',
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    term_start TEXT,
    term_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    society_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    from_date TEXT NOT NULL,
    to_date TEXT NOT NULL,
    amount_inr INTEGER NOT NULL,
    amount_in_words TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by_phone TEXT,
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_invoices_society ON invoices(society_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    notice_date TEXT NOT NULL,
    notice_type TEXT NOT NULL DEFAULT 'Information',
    applies_to_all INTEGER NOT NULL DEFAULT 1,
    attachment_path TEXT,
    created_by_phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    edited_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notices_created ON notices(created_at DESC);

  CREATE TABLE IF NOT EXISTS notice_societies (
    notice_id INTEGER NOT NULL,
    society_id INTEGER NOT NULL,
    PRIMARY KEY (notice_id, society_id),
    FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
    FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
  );
`);

// ===== Drop deprecated tables (tanker / garbage tracking removed from the app) =====
db.exec(`
  DROP TABLE IF EXISTS water_tanker_logs;
  DROP TABLE IF EXISTS garbage_misses;
`);

// ===== Idempotent additive migrations =====
function ensureColumn(table, col, ddl) {
  const cols = db.pragma(`table_info(${table})`);
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  }
}
ensureColumn('societies', 'convenience_stores', 'INTEGER DEFAULT 0');
ensureColumn('societies', 'membership_end_date', 'TEXT');
ensureColumn('societies', 'last_payment_date', 'TEXT');
ensureColumn('societies', 'overdue_amount', 'INTEGER DEFAULT 0');

// VENT social-feed extras
ensureColumn('vent_issues', 'instagram_handle', 'TEXT');
ensureColumn('vent_issues', 'x_handle', 'TEXT');
ensureColumn('vent_issues', 'facebook_handle', 'TEXT');
ensureColumn('vent_issues', 'likes_count', 'INTEGER DEFAULT 0');
ensureColumn('vent_issues', 'dislikes_count', 'INTEGER DEFAULT 0');
ensureColumn('vent_issues', 'civic_tags', "TEXT DEFAULT '[]'");
ensureColumn('vent_issues', 'last_activity_at', 'TEXT');
ensureColumn('vent_comments', 'society', 'TEXT');
// Backfill last_activity_at for any pre-existing rows so the 7-day cleanup
// doesn't immediately delete legacy data.
db.exec(`UPDATE vent_issues SET last_activity_at = COALESCE(last_activity_at, created_at)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS vent_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vent_issue_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (vent_issue_id) REFERENCES vent_issues(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_vent_comments_issue ON vent_comments(vent_issue_id, created_at);

  CREATE TABLE IF NOT EXISTS vent_followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vent_issue_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (vent_issue_id) REFERENCES vent_issues(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_vent_followups_issue ON vent_followups(vent_issue_id, created_at);
`);

// ===== One-time data seeding for existing societies that don't yet have membership info =====
const needsSeed = db.prepare(
  'SELECT id FROM societies WHERE membership_end_date IS NULL'
).all();

const seedActive = db.prepare(`
  UPDATE societies SET
    convenience_stores = COALESCE(NULLIF(convenience_stores, 0), 3),
    membership_end_date = date('now', '+240 days'),
    last_payment_date = date('now', '-125 days'),
    overdue_amount = 0
  WHERE id = ?
`);
const seedOverdue = db.prepare(`
  UPDATE societies SET
    convenience_stores = COALESCE(NULLIF(convenience_stores, 0), 2),
    membership_end_date = date('now', '-60 days'),
    last_payment_date = date('now', '-425 days'),
    overdue_amount = 12000
  WHERE id = ?
`);
needsSeed.forEach((s, i) => {
  if (i % 2 === 0) seedOverdue.run(s.id);
  else seedActive.run(s.id);
});

// ===== Seed default documents (Share Certificate + 2 receipts) for societies with none =====
const seedDocsFor = db.transaction((society_id, year_established) => {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM documents WHERE society_id = ?').get(society_id).c;
  if (existing > 0) return;
  const ins = db.prepare(
    'INSERT INTO documents (society_id, type, name, issued_date) VALUES (?, ?, ?, ?)'
  );
  const issued = year_established ? `${year_established}-04-15` : `${new Date().getFullYear() - 2}-04-15`;
  ins.run(society_id, 'share_certificate', 'Share Certificate', issued);
  const thisYear = new Date().getFullYear();
  ins.run(society_id, 'receipt', `Membership Receipt FY ${thisYear - 1}-${String(thisYear).slice(2)}`, `${thisYear - 1}-04-10`);
  ins.run(society_id, 'receipt', `Membership Receipt FY ${thisYear - 2}-${String(thisYear - 1).slice(2)}`, `${thisYear - 2}-04-12`);
  ins.run(society_id, 'other', 'Bye-laws (2021 amendment)', `${thisYear - 4}-08-22`);
});
db.prepare('SELECT id, year_established FROM societies').all().forEach((s) =>
  seedDocsFor(s.id, s.year_established)
);

// ===== Seed the 11-member federation managing committee (one-time, shared) =====
const FEDERATION_COMMITTEE = [
  { salutation: 'Shri.', name: 'Dr. Suresh Bhosale',  title: 'President' },
  { salutation: 'Shri.', name: 'Vinod Kale',          title: 'Vice-President' },
  { salutation: 'Smt.',  name: 'Sunita Deshpande',    title: 'General Secretary' },
  { salutation: 'Shri.', name: 'Prakash Mhetre',      title: 'Joint Secretary' },
  { salutation: 'Shri.', name: 'Mahendra Kadam',      title: 'Treasurer' },
  { salutation: 'Smt.',  name: 'Rekha Pawar',         title: 'Joint Treasurer' },
  { salutation: 'Shri.', name: 'Anil Bhandari',       title: 'Executive Member — Civic Affairs' },
  { salutation: 'Smt.',  name: 'Nirmala Gokhale',     title: 'Executive Member — Legal' },
  { salutation: 'Shri.', name: 'Rajendra Wagh',       title: 'Executive Member — Water & Sanitation' },
  { salutation: 'Smt.',  name: 'Madhavi Phadtare',    title: 'Executive Member — Outreach' },
  { salutation: 'Shri.', name: 'Sandeep Mane',        title: 'Co-opted Member — Audit' },
];

const fcCount = db.prepare('SELECT COUNT(*) AS c FROM federation_committee').get().c;
if (fcCount === 0) {
  const ins = db.prepare(
    `INSERT INTO federation_committee (position, salutation, name, title, term_start, term_end)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const termStart = '2024-04-01';
  const termEnd = '2027-03-31';
  FEDERATION_COMMITTEE.forEach((m, idx) => {
    ins.run(idx + 1, m.salutation, m.name, m.title, termStart, termEnd);
  });
}

// ===== Seed sample civic VENT posts (with illustration images) the first time =====
const ventSeedCount = db.prepare('SELECT COUNT(*) AS c FROM vent_issues WHERE photo_path LIKE ?').get('/samples/%').c;
if (ventSeedCount === 0) {
  const insertPost = db.prepare(`
    INSERT INTO vent_issues (
      society_id, reporter_name, category, title, description, location, severity, photo_path,
      civic_tags, last_activity_at, likes_count, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
  `);
  const insertComment = db.prepare(
    `INSERT INTO vent_comments (vent_issue_id, author_name, body, society) VALUES (?, ?, ?, ?)`
  );
  const seedPost = (society_id, payload, comments) => {
    const info = insertPost.run(
      society_id, payload.reporter, payload.category, payload.title, payload.description,
      payload.location, payload.severity, payload.photo,
      JSON.stringify(payload.tags || []), payload.likes || 0, payload.status || 'open'
    );
    (comments || []).forEach((c) =>
      insertComment.run(info.lastInsertRowid, c.name, c.body, c.society)
    );
  };

  // Shree Sai (id 1)
  seedPost(1, {
    reporter: 'Priya K.', category: 'road', severity: 'urgent',
    title: 'Crater-sized pothole on the main highway service road',
    description: 'A 2-feet deep pothole has formed on the service road outside our society gate. Two scooters have already fallen. PCMC complaint #PMC-7782 logged but no action in 12 days.',
    location: 'Service road, near gate B',
    photo: '/samples/pothole.svg',
    tags: ['PWD', 'PCMC Roads'],
    likes: 14,
  }, [
    { name: 'Member', society: 'Shree Sai Residency CHS Ltd',
      body: 'Confirmed — almost crashed there this morning. Two-wheelers are at real risk.' },
    { name: 'Member', society: 'Sunshine Apartments CHS',
      body: 'Same problem near our gate. We should file a joint federation complaint.' },
    { name: 'Member', society: 'Shree Sai Residency CHS Ltd',
      body: 'Putting an orange cone tonight as a temporary marker.' },
  ]);

  // Shree Sai (id 1) — streetlight
  seedPost(1, {
    reporter: 'Rahul S.', category: 'streetlight', severity: 'high',
    title: 'Streetlight outside gate has been dead for over a week',
    description: 'Pole #C-14 — lamp is broken and not lighting up. Risk for evening commuters and women returning home after work. Reported to MSEDCL through Ward 14 office.',
    location: 'Pole C-14, Sector 9',
    photo: '/samples/streetlight.svg',
    tags: ['MSEDCL Electricity', 'PCMC Electrical', 'Ward 14 Office'],
    likes: 9, status: 'in_progress',
  }, [
    { name: 'Member', society: 'Shree Sai Residency CHS Ltd',
      body: 'Ward office said the bulb has been ordered. Will follow up next Monday.' },
    { name: 'Member', society: 'Sunshine Apartments CHS',
      body: 'Took us 3 weeks last time. Keep escalating!' },
  ]);

  // Sunshine (id 2) — garbage
  seedPost(2, {
    reporter: 'Anil P.', category: 'sewage', severity: 'high',
    title: 'Garbage truck has skipped wet-waste pickup three days in a row',
    description: 'SWM truck has not visited Lane 4 since Sunday. Bin is overflowing onto the pavement, flies and stink everywhere. Complaint placed with Ward 7 sanitation supervisor.',
    location: 'Lane 4 collection point',
    photo: '/samples/garbage.svg',
    tags: ['PCMC SWM (Garbage)', 'PCMC Health'],
    likes: 22,
  }, [
    { name: 'Member', society: 'Sunshine Apartments CHS',
      body: 'Same here at Building C. Truck driver said route was changed without notice.' },
    { name: 'Member', society: 'Shree Sai Residency CHS Ltd',
      body: 'We faced this last month — federation escalation worked in 48 hours.' },
    { name: 'Member', society: 'Sunshine Apartments CHS',
      body: 'Tagging health officer via official Twitter handle as well.' },
  ]);

  // Sunshine (id 2) — burst water pipe
  seedPost(2, {
    reporter: 'Meena J.', category: 'water', severity: 'urgent',
    title: 'Burst PCMC water pipe near junction — wasting 1000s of litres daily',
    description: 'Main pipeline has cracked at the junction. Water is gushing out for the last 2 days, flooding the road and entering ground-floor flats. URGENT.',
    location: 'Wakad – Hinjawadi junction',
    photo: '/samples/water.svg',
    tags: ['PCMC Water Supply', 'PWD'],
    likes: 31,
  }, [
    { name: 'Member', society: 'Sunshine Apartments CHS',
      body: 'My building basement has 2 inches of water now. Filed report at 24x7 helpline.' },
    { name: 'Member', society: 'Shree Sai Residency CHS Ltd',
      body: 'Sharing on the federation WhatsApp group for visibility.' },
  ]);

  // Shree Sai (id 1) — sewage overflow
  seedPost(1, {
    reporter: 'Sushma K.', category: 'sewage', severity: 'high',
    title: 'Manhole cover missing — sewage overflowing onto walkway',
    description: 'Manhole cover stolen last week. Now the drain is overflowing during morning peak hours. Children walk to school past this — health hazard.',
    location: 'Beside society gate A',
    photo: '/samples/sewage.svg',
    tags: ['PCMC Sewerage', 'PCMC Health'],
    likes: 17, status: 'resolved',
  }, [
    { name: 'Member', society: 'Shree Sai Residency CHS Ltd',
      body: 'PCMC team came yesterday and installed a new cover. Marking this resolved.' },
    { name: 'Member', society: 'Sunshine Apartments CHS',
      body: 'Glad to hear! 11 days from report to resolution is actually quick for PCMC.' },
  ]);
}

// ===== Seed sample admin demo data (status mix + a pending change request) =====
// Promote society id=2 (Sunshine) to 'active' so the demo shows multiple statuses
db.prepare(`UPDATE societies SET status = 'active' WHERE id = 2 AND status = 'pending'`).run();

// Add a sample pending change request for society 1 (Shree Sai) — submitted by Priya
const hasSampleScr = db.prepare(
  `SELECT id FROM society_change_requests WHERE society_id = 1 LIMIT 1`
).get();
if (!hasSampleScr) {
  const society = db.prepare('SELECT id FROM societies WHERE id = 1').get();
  if (society) {
    db.prepare(
      `INSERT INTO society_change_requests (society_id, requested_by_phone, payload, status)
       VALUES (?, ?, ?, 'pending')`
    ).run(
      1,
      '9988776655',
      JSON.stringify({
        chairperson_name: 'Anil V. Patil',
        address_line2: 'Opposite Community Hall, Sector 9',
        convenience_stores: 3,
      })
    );
  }
}
