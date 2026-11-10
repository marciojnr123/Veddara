// app/api/estoque/pendencias/route.ts
// Pedidos parados por produto (vendas sem integração, Mile sem integração, TriStar em rascunho),
// já calculados no Postgres da VM. Zero regra de negócio aqui: só converte os nomes dos campos.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import https from 'https'

export interface PendenciaItem {
  tipo: 'venda_sem_int' | 'mile_sem_int' | 'tristar_rascunho'
  productId: string
  produto: string
  invoice: string
  data: string                   // YYYY-MM-DD
  diasParado: number
  cliente: string
  vendedor: string
  qtd: number
  transportadora: string | null  // MILE, TRISTAR ou null
  rastreio: string | null
  situacao: string               // texto pronto, vindo do banco
  plano: string | null
  controleManual: boolean        // produtos de controle manual (160, 161, 162, 171)
}

// Mesma API do estoque, path /pendencias (troca o sufixo /estoque da env).
const BASE = process.env.ESTOQUE_API_URL || 'https://173.254.245.217:8443/estoque'
const API_URL = BASE.replace(/\/estoque$/, '/pendencias')
const API_KEY = process.env.ESTOQUE_API_KEY || ''

function fetchPendencias(): Promise<Record<string, unknown>[]> {
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
const s = (v: unknown): string => (v == null ? '' : String(v))
const sOuNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v))
const TIPOS = new Set(['venda_sem_int', 'mile_sem_int', 'tristar_rascunho'])

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const rows = await fetchPendencias()
    const itens: PendenciaItem[] = rows
      .filter(r => TIPOS.has(String(r.tipo)))
      .map(r => ({
        tipo: r.tipo as PendenciaItem['tipo'],
        productId: String(r.product_id),
        produto: s(r.produto),
        invoice: s(r.invoice),
        data: s(r.data),
        diasParado: n(r.dias_parado),
        cliente: s(r.cliente),
        vendedor: s(r.vendedor),
        qtd: n(r.qtd),
        transportadora: sOuNull(r.transportadora),
        rastreio: sOuNull(r.rastreio),
        situacao: s(r.situacao),
        plano: sOuNull(r.plano),
        controleManual: r.controle_manual === true,
      }))
    return NextResponse.json({ itens }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
