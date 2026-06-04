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

// Run once on startup — adds columns that didn't exist in the original init.sql
export async function runMigrations(): Promise<void> {
  const migrations = [
    `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS read_at     DATETIME DEFAULT NULL`,
    `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS replied_at  DATETIME DEFAULT NULL`,
    `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS replied_by  VARCHAR(200) DEFAULT NULL`,
    `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS admin_note  TEXT`,
    // add user_id index to download_stats if missing
    `ALTER TABLE download_stats ADD INDEX IF NOT EXISTS idx_user (user_id(32))`,
  ]
  for (const sql of migrations) {
    try { await pool.execute(sql) } catch { /* column/index already exists — safe to ignore */ }
  }
}
