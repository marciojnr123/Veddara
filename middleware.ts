import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/health']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Verifica apenas a presença do token (cookie ou header Bearer) — a validação
  // do JWT ocorre em Node.js dentro de cada API route / server component.
  const header = req.headers.get('authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined
  const token = req.cookies.get('auth_token')?.value || bearer
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Cargo "estoque": só pode acessar a aba Estoque (e o que ela precisa).
  // Lê o cargo do payload do JWT (sem verificar assinatura — só p/ gating de rota;
  // a validação real da assinatura ocorre nas API routes via getSession).
  if (rolePayload(token) === 'estoque') {
    const permitido =
      pathname.startsWith('/estoque') ||
      pathname.startsWith('/api/estoque') ||
      pathname.startsWith('/api/auth')
    if (!permitido) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/estoque', req.url))
    }
  }

  return NextResponse.next()
}

// Decodifica o payload do JWT (base64url) só para ler o cargo. Não valida assinatura.
function rolePayload(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64)
    return (JSON.parse(json)?.role as string) ?? null
  } catch {
    return null
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
