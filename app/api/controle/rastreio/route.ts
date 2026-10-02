// app/api/controle/rastreio/route.ts
// Proxy (POST) para o endpoint de ESCRITA da VM: substituir o rastreio de um pedido.
// A chave de escrita (ESTOQUE_API_WRITE_KEY) fica SÓ no server — nunca vai pro client.
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import https from 'https'

const BASE = process.env.ESTOQUE_API_URL || 'https://173.254.245.217:8443/estoque'
const API_URL = process.env.ESTOQUE_RASTREIO_URL || BASE.replace(/\/estoque$/, '/rastreio')
const WRITE_KEY = process.env.ESTOQUE_API_WRITE_KEY || ''

function postRastreio(payload: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-API-Key': WRITE_KEY,
      },
      rejectUnauthorized: false,
      timeout: 20000,
    }, res => {
      let body = ''
      res.on('data', c => (body += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 500, body }))
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.write(payload)
    req.end()
  })
}

export async function POST(req: NextRequest) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const body = await req.json()
    const { status, body: respBody } = await postRastreio(JSON.stringify(body))
    // Repassa a resposta da VM como veio (JSON quando possível, com o mesmo status)
    try {
      return NextResponse.json(JSON.parse(respBody), { status, headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return NextResponse.json({ error: respBody.slice(0, 300) || 'Resposta inválida da API' }, { status: status === 200 ? 502 : status })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
