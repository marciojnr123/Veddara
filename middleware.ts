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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
