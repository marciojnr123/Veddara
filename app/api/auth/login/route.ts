import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { signToken, type Role } from '@/lib/auth'

type UserRow = {
  id: number
  name: string | null
  email: string
  password_hash: string
  role: Role
  active: boolean
}

export async function POST(req: NextRequest) {
  try {
    // Aceita tanto { email, senha } (frontend atual) quanto { email, password }
    const body = await req.json()
    const email: string | undefined = body.email
    const password: string | undefined = body.password ?? body.senha

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 })
    }

    const emailNorm = String(email).trim().toLowerCase()
    const r = await query<UserRow>(
      'SELECT id, name, email, password_hash, role, active FROM users WHERE email = $1',
      [emailNorm],
    )
    const user = r.rows[0]

    // Mesmo erro genérico para "não existe" e "senha errada" (não vaza informação)
    if (!user) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    if (!user.active) {
      return NextResponse.json({ error: 'Usuário desativado' }, { status: 403 })
    }

    const ok = await bcrypt.compare(String(password), user.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      nome: user.name ?? user.email,
      role: user.role,
    })

    const payload = {
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }

    const res = NextResponse.json(payload)
    // Mantém o cookie httpOnly usado pelo frontend (sessão de 8h)
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[login]', msg)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
