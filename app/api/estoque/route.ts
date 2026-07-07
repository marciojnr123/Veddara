// app/api/estoque/route.ts
// Lê o estoque já calculado do Postgres (via endpoint HTTPS da VM). Zero regra de negócio aqui.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import https from 'https'
export interface EstoqueItem {
  productId: string
  sku: string
  produto: string
  marca: string
  atual: number
  reservado: number
  disponivel: number
  minimo: number
  vendasSemInt: number
  mileSemInt: number
  qtEnviada: number
  remessasNaoInt: number
  compras: number
  inicial: number
  estoqueLogico: number
  status: 'OK' | 'NOK'
}
const API_URL = process.env.ESTOQUE_API_URL || 'https://173.254.245.217:8443/estoque'
const API_KEY = process.env.ESTOQUE_API_KEY || ''
function fetchEstoque(): Promise<Record<string, unknown>[]> {
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
    const rows = await fetchEstoque()
    const itens: EstoqueItem[] = rows.map(r => ({
      productId: String(r.product_id),
      sku: (r.sku_mile as string) ?? '',
      produto: (r.nome as string) ?? '',
      marca: (r.marca as string) ?? '',
      atual: n(r.est_mile),
      reservado: 0,
      disponivel: 0,
      minimo: 0,
      vendasSemInt: n(r.vendas_marco),
      mileSemInt: n(r.mile_marco),
      qtEnviada: n(r.qt_enviada),
      remessasNaoInt: n(r.remessas_nao_env),
      compras: n(r.compras),
      inicial: n(r.inicial),
      estoqueLogico: n(r.estoque_logico),
      status: r.status === 'OK' ? 'OK' : 'NOK',
    }))
    return NextResponse.json({ itens }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
