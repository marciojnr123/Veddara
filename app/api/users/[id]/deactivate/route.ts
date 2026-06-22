import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

// Desativa um usuário sem deletar do banco — somente admin.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req, ['admin'])
  if (auth instanceof NextResponse) return auth

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const r = await query(
      `UPDATE users SET active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, role, active, updated_at`,
      [id],
    )
    if (r.rowCount === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ user: r.rows[0] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[users:deactivate]', msg)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
