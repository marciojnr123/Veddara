import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { isRole } from '@/lib/auth'
import { requireAuth } from '@/lib/api-auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Apenas admin pode cadastrar usuários (já que o cargo pode ser definido).
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, ['admin'])
  if (auth instanceof NextResponse) return auth

  try {
    const { name, email, password, role } = await req.json()

    if (!email || !EMAIL_RE.test(String(email))) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    }
    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: 'Senha obrigatória (mín. 6 caracteres)' }, { status: 400 })
    }
    // Se nenhum role for enviado, usa 'user'
    const finalRole = role == null || role === '' ? 'user' : role
    if (!isRole(finalRole)) {
      return NextResponse.json({ error: 'Cargo (role) inválido' }, { status: 400 })
    }

    const emailNorm = String(email).trim().toLowerCase()

    // Valida se o e-mail já existe
    const existe = await query('SELECT 1 FROM users WHERE email = $1', [emailNorm])
    if (existe.rowCount && existe.rowCount > 0) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
    }

    // Gera o hash da senha (nunca salva senha pura)
    const password_hash = await bcrypt.hash(String(password), 10)

    const ins = await query(
      `INSERT INTO users (name, email, password_hash, role, active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, email, role, active, created_at`,
      [name ?? null, emailNorm, password_hash, finalRole],
    )

    return NextResponse.json({ user: ins.rows[0] }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[register]', msg)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
