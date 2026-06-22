import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// Retorna o usuário logado (a partir do cookie). Usado pelo frontend para
// saber o cargo e exibir/ocultar áreas restritas.
export async function GET() {
  const user = getSession()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return NextResponse.json({
    user: { id: user.userId, email: user.email, nome: user.nome, role: user.role },
  })
}
