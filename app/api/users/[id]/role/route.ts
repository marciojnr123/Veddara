import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isRole } from '@/lib/auth'
import { requireAuth } from '@/lib/api-auth'

// Altera o cargo (role) de um usuário — somente admin.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req, ['admin'])
  if (auth instanceof NextResponse) return auth

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const { role } = await req.json()
    if (!isRole(role)) {
      return NextResponse.json({ error: 'Cargo (role) inválido' }, { status: 400 })
    }

    const r = await query(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, role, active, updated_at`,
      [role, id],
    )
    if (r.rowCount === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ user: r.rows[0] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[users:role]', msg)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
