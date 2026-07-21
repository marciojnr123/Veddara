// app/api/auditoria/route.ts
// Lê a auditoria de movimento (vw_auditoria) do endpoint HTTPS da VM.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import https from 'https'

export interface AuditoriaItem {
  productId: string
  produto: string
  mileInicio: number
  mileAgora: number
  variouMile: number       // quanto a Mile mudou no período
  vendas: number           // vendas no período
  compras: number          // compras no período
  variacaoEsperada: number // compras − vendas
  desvio: number           // variouMile − variacaoEsperada (negativo = Mile perdeu)
  auditoria: string        // 'FLAG (Mile perdeu)' | 'revisar (sobra)' | 'ok'
}

// Reaproveita a mesma variável do estoque, trocando o caminho para /auditoria.
const BASE_URL = process.env.ESTOQUE_API_URL || 'https://173.254.245.217:8443/estoque'
const API_URL = BASE_URL.replace(/\/estoque$/, '/auditoria')
const API_KEY = process.env.ESTOQUE_API_KEY || ''

function fetchAuditoria(): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const req = https.request(API_URL, {
      method: 'GET',
      headers: { 'X-API-Key': API_KEY },
      rejectUnauthorized: false,
      timeout: 20000,
    }, res => {
      let body = ''
      res.on('data', c => (body += c))
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`API ${res.statusCode}: ${body.slice(0, 200)}`))
        try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.end()
  })
}

const n = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const rows = await fetchAuditoria()
    const itens: AuditoriaItem[] = rows.map(r => ({
      productId: String(r.product_id),
      produto: (r.nome as string) ?? '',
      mileInicio: n(r.mile_inicio),
      mileAgora: n(r.mile_agora),
      variouMile: n(r.variou_mile),
      vendas: n(r.vendas_periodo),
      compras: n(r.compras_periodo),
      variacaoEsperada: n(r.variacao_esperada),
      desvio: n(r.desvio),
      auditoria: (r.auditoria as string) ?? 'ok',
    }))
    return NextResponse.json({ itens }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
