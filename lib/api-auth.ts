import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, type JWTPayload, type Role } from '@/lib/auth'

/**
 * Equivalente ao `auth(["admin", ...])` do Express, adaptado a route handlers
 * do Next.js. Lê o token do header Authorization: Bearer ou do cookie auth_token.
 *
 * Uso dentro de uma rota:
 *   const auth = requireAuth(req, ['admin'])
 *   if (auth instanceof NextResponse) return auth   // 401/403
 *   const user = auth                                // JWTPayload válido
 *
 * @param roles  Se informado, o usuário precisa ter um dos cargos da lista.
 */
export function requireAuth(req: NextRequest, roles?: Role[]): JWTPayload | NextResponse {
  // 1) tenta o header Authorization: Bearer TOKEN
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  let token: string | undefined
  if (header?.startsWith('Bearer ')) token = header.slice(7).trim()
  // 2) cai para o cookie httpOnly usado pelo frontend
  if (!token) token = req.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const user = verifyToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 })
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  return user
}
