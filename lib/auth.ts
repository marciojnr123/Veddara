import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me'

// Cargos válidos do sistema
export const ROLES = ['admin', 'financeiro', 'consultor', 'operacao', 'user'] as const
export type Role = (typeof ROLES)[number]
export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

export interface JWTPayload {
  userId: number
  email: string
  nome: string
  role: Role
}

export function signToken(payload: JWTPayload): string {
  // Token expira em 8 horas
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

/** Lê a sessão a partir do cookie httpOnly (server components / route handlers). */
export function getSession(): JWTPayload | null {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('auth_token')?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}
