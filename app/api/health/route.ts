import { NextResponse } from 'next/server'

// Healthcheck do Railway: reflete apenas se o Next.js está no ar.
// NÃO chama o agente Sybase aqui — dependência externa não pode deixar o
// healthcheck lento nem derrubar/reiniciar o deploy.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
