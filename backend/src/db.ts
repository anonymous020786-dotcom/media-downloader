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
