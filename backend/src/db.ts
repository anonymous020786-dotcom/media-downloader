import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host:              process.env.MYSQL_HOST     ?? 'mysql',
  port:              Number(process.env.MYSQL_PORT ?? 3306),
  database:          process.env.MYSQL_DATABASE  ?? 'mediadl',
  user:              process.env.MYSQL_USER       ?? 'mediadl',
  password:          process.env.MYSQL_PASSWORD   ?? 'mediadlpass',
  waitForConnections: true,
  connectionLimit:   10,
  queueLimit:        0,
  timezone:          '+00:00',
  charset:           'utf8mb4',
})

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

const DB = process.env.MYSQL_DATABASE ?? 'mediadl'

// MySQL 8.0 does NOT support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
// (that's MariaDB syntax). We check information_schema first, then add.
async function tableExists(table: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
    [DB, table]
  )
  return (rows[0]?.n ?? 0) > 0
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [DB, table, column]
  )
  return (rows[0]?.n ?? 0) > 0
}

async function indexExists(table: string, index: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [DB, table, index]
  )
  return (rows[0]?.n ?? 0) > 0
}

async function addColumn(table: string, column: string, ddl: string): Promise<void> {
  if (!(await tableExists(table))) return            // base table not present yet — skip
  if (await columnExists(table, column)) return
  try { await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`) }
  catch (e: any) { console.warn(`[db] addColumn ${table}.${column} failed: ${e.message}`) }
}

async function addIndex(table: string, index: string, ddl: string): Promise<void> {
  if (!(await tableExists(table))) return
  if (await indexExists(table, index)) return
  try { await pool.execute(`ALTER TABLE \`${table}\` ADD ${ddl}`) }
  catch (e: any) { console.warn(`[db] addIndex ${table}.${index} failed: ${e.message}`) }
}

// Run once on startup — adds tables/columns/indexes that didn't exist in init.sql
export async function runMigrations(): Promise<void> {
  // ── Users table (Supabase auth UUIDs + app roles) ─────────────────────────────
  await pool.execute(`CREATE TABLE IF NOT EXISTS users (
    id           VARCHAR(36)  PRIMARY KEY,
    email        VARCHAR(200) NOT NULL UNIQUE,
    name         VARCHAR(200),
    avatar_url   VARCHAR(500),
    role         ENUM('user','admin','super_admin') NOT NULL DEFAULT 'user',
    last_sign_in DATETIME     DEFAULT NULL,
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`)

  await addIndex('users', 'idx_role', 'INDEX idx_role (role)')

  // ── contact_messages columns ──────────────────────────────────────────────────
  await addColumn('contact_messages', 'read_at',    'read_at    DATETIME DEFAULT NULL')
  await addColumn('contact_messages', 'replied_at', 'replied_at DATETIME DEFAULT NULL')
  await addColumn('contact_messages', 'replied_by', 'replied_by VARCHAR(200) DEFAULT NULL')
  await addColumn('contact_messages', 'admin_note', 'admin_note TEXT')

  // ── download_stats columns ──────────────────────────────────────────────────────
  await addColumn('download_stats', 'job_id', 'job_id VARCHAR(36) DEFAULT NULL')
  await addColumn('download_stats', 'title',  'title  VARCHAR(500) DEFAULT NULL')
  await addColumn('download_stats', 'files',  'files  TEXT DEFAULT NULL')
  await addColumn('download_stats', 's3_url', 's3_url VARCHAR(1000) DEFAULT NULL')
  await addIndex('download_stats', 'idx_user',   'INDEX idx_user (user_id(32))')
  await addIndex('download_stats', 'idx_job_id', 'INDEX idx_job_id (job_id)')

  // ── Extended user profile columns ──────────────────────────────────────────────
  const userCols: [string, string][] = [
    ['username',              'username VARCHAR(50)'],
    ['phone',                 'phone VARCHAR(30)'],
    ['phone_verified',        'phone_verified TINYINT(1) DEFAULT 0'],
    ['dob',                   'dob DATE'],
    ['gender',                "gender ENUM('male','female','non_binary','prefer_not_to_say')"],
    ['country',               'country VARCHAR(100)'],
    ['state_region',          'state_region VARCHAR(100)'],
    ['city',                  'city VARCHAR(100)'],
    ['postal_code',           'postal_code VARCHAR(20)'],
    ['address_line1',         'address_line1 VARCHAR(300)'],
    ['address_line2',         'address_line2 VARCHAR(300)'],
    ['bio',                   'bio TEXT'],
    ['website',               'website VARCHAR(300)'],
    ['twitter_handle',        'twitter_handle VARCHAR(100)'],
    ['instagram_handle',      'instagram_handle VARCHAR(100)'],
    ['youtube_channel',       'youtube_channel VARCHAR(300)'],
    ['linkedin_profile',      'linkedin_profile VARCHAR(300)'],
    ['github_username',       'github_username VARCHAR(100)'],
    ['microsoft_handle',      'microsoft_handle VARCHAR(100)'],
    ['occupation',            'occupation VARCHAR(200)'],
    ['company',               'company VARCHAR(200)'],
    ['industry',              'industry VARCHAR(200)'],
    ['language',              "language VARCHAR(10) DEFAULT 'en'"],
    ['newsletter_subscribed', 'newsletter_subscribed TINYINT(1) DEFAULT 0'],
    ['profile_complete',      'profile_complete TINYINT(1) DEFAULT 0'],
    ['s3_avatar_key',         's3_avatar_key VARCHAR(500)'],
    // ── MFA: backup email + TOTP (authenticator app) ──────────────────────────
    ['backup_email',          'backup_email VARCHAR(200)'],
    ['backup_email_verified', 'backup_email_verified TINYINT(1) DEFAULT 0'],
    ['totp_secret',           'totp_secret VARCHAR(255)'],
    ['totp_enabled',          'totp_enabled TINYINT(1) DEFAULT 0'],
    ['totp_backup_codes',     'totp_backup_codes TEXT'],
    ['mfa_enabled',           'mfa_enabled TINYINT(1) DEFAULT 0'],
    ['preferred_mfa_method',  "preferred_mfa_method ENUM('email','backup_email','totp') DEFAULT 'email'"],
  ]
  for (const [name, ddl] of userCols) await addColumn('users', name, ddl)

  // username must be unique (added as a unique index after the column exists)
  await addIndex('users', 'idx_username', 'UNIQUE INDEX idx_username (username)')

  // ── Super-admin seed ─────────────────────────────────────────────────────────
  // SUPER_ADMIN_EMAIL is set once in .env — this is the ONLY way to get super_admin.
  // No API endpoint can grant this role.
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()
  if (superAdminEmail) {
    try {
      await pool.execute(
        `INSERT INTO users (id, email, role)
         VALUES (UUID(), ?, 'super_admin')
         ON DUPLICATE KEY UPDATE role = IF(role = 'super_admin', 'super_admin', role)`,
        [superAdminEmail]
      )
    } catch { /* non-critical */ }
  }
}
