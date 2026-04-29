import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../kredito.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      email                TEXT UNIQUE NOT NULL,
      stellar_pub          TEXT UNIQUE NOT NULL,
      stellar_enc_secret   TEXT,
      is_external          BOOLEAN NOT NULL DEFAULT 0,
      email_verified       BOOLEAN NOT NULL DEFAULT 0,
      otp_hash             TEXT,
      otp_expires_at       DATETIME,
      otp_attempt_count    INTEGER NOT NULL DEFAULT 0,
      otp_locked_until     DATETIME,
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const userColumns = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const userColumnNames = new Set(userColumns.map((column) => column.name));

  if (!userColumnNames.has('is_external')) {
    db.exec(`ALTER TABLE users ADD COLUMN is_external BOOLEAN NOT NULL DEFAULT 0`);
  }

  if (!userColumnNames.has('last_login_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN last_login_at DATETIME`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_requests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_otp_requests_user_time ON otp_requests(user_id, sent_at)`,
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_challenges (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      stellar_pub   TEXT NOT NULL,
      challenge_hash TEXT NOT NULL UNIQUE,
      expires_at    DATETIME NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_auth_challenges_lookup ON auth_challenges(stellar_pub, challenge_hash)`,
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS bootstrap_assessments (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id              INTEGER NOT NULL REFERENCES users(id),
      email_verified       BOOLEAN NOT NULL DEFAULT 0,
      monthly_income_band  TEXT NOT NULL,
      monthly_expense_band TEXT NOT NULL,
      employment_type      TEXT NOT NULL,
      has_business_permit  BOOLEAN NOT NULL DEFAULT 0,
      has_brgy_certificate BOOLEAN NOT NULL DEFAULT 0,
      has_coop_membership  BOOLEAN NOT NULL DEFAULT 0,
      bootstrap_score      INTEGER NOT NULL,
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS score_events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      tier             INTEGER NOT NULL,
      score            INTEGER NOT NULL,
      bootstrap_score  INTEGER NOT NULL DEFAULT 0,
      stellar_score    INTEGER NOT NULL DEFAULT 0,
      score_json       TEXT NOT NULL,
      sbt_minted       BOOLEAN NOT NULL DEFAULT 0,
      sbt_tx_hash      TEXT,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS active_loans (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      stellar_pub TEXT NOT NULL UNIQUE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_active_loans_user ON active_loans(user_id)`);
}

export default db;
