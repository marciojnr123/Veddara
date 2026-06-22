// Migration + seed do sistema de usuários.
// Rodar localmente:   node --env-file=.env scripts/migrate.mjs
// Na Railway:         node scripts/migrate.mjs   (as env vars já existem)
import pg from 'pg'
import bcrypt from 'bcryptjs'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('✗ DATABASE_URL não definida. Configure no .env ou nas variáveis da Railway.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Cargos válidos do sistema: admin, financeiro, consultor, operacao, user
const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120),
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`

async function main() {
  console.log('→ Criando tabela users (se não existir)...')
  await pool.query(CREATE_TABLE)
  console.log('✓ Tabela pronta.')

  // Seed do primeiro admin
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const senha = process.env.ADMIN_PASSWORD || ''
  const nome = process.env.ADMIN_NAME || 'Administrador'

  if (!email || !senha) {
    console.log('ℹ ADMIN_EMAIL/ADMIN_PASSWORD não definidos — pulando criação do admin.')
  } else {
    const existe = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existe.rowCount > 0) {
      console.log(`ℹ Admin ${email} já existe (id ${existe.rows[0].id}).`)
    } else {
      const hash = await bcrypt.hash(senha, 10)
      const r = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, active)
         VALUES ($1, $2, $3, 'admin', true) RETURNING id`,
        [nome, email, hash],
      )
      console.log(`✓ Admin criado: ${email} (id ${r.rows[0].id}).`)
    }
  }

  await pool.end()
  console.log('✓ Migration concluída.')
}

main().catch(async (e) => {
  console.error('✗ Erro na migration:', e.message)
  await pool.end().catch(() => {})
  process.exit(1)
})
