import { Pool } from 'pg'

// Pool único e preguiçoso: só é criado na primeira query (evita falhar no
// `next build`, quando DATABASE_URL ainda não está disponível) e reaproveitado
// entre hot-reloads do Next em desenvolvimento.
const globalForDb = globalThis as unknown as { _pgPool?: Pool }

export function getPool(): Pool {
  if (globalForDb._pgPool) return globalForDb._pgPool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL não configurada')

  const pool = new Pool({
    connectionString,
    // Railway/Postgres gerenciado exige SSL com certificado autoassinado
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
  })
  globalForDb._pgPool = pool
  return pool
}

// Helper curto para queries parametrizadas
export function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) {
  return getPool().query<T>(text, params)
}
