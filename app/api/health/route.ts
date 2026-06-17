import { NextResponse } from 'next/server'
import { agentHealth } from '@/lib/agent'

export async function GET() {
  // O healthcheck precisa refletir apenas se a aplicação Next.js está no ar.
  // O agente Sybase é uma dependência externa: se estiver offline, reportamos
  // como "degraded" no corpo, mas mantemos HTTP 200 para não derrubar o deploy.
  try {
    const agentStatus = await agentHealth()
    return NextResponse.json({ status: 'ok', agent: agentStatus })
  } catch (e) {
    return NextResponse.json({ status: 'degraded', agent: 'offline', error: String(e) })
  }
}
