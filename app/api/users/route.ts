import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

// Lista usuários — somente admin. Nunca retorna password_hash.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, ['admin'])
  if (auth instanceof NextResponse) return auth

  try {
    const r = await query(
      `SELECT id, name, email, role, active, created_at
       FROM users
       ORDER BY created_at DESC`,
    )
    return NextResponse.json({ users: r.rows })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[users:list]', msg)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
