// app/api/controle/route.ts
// Lê o controle de remessas não entregues (Mile + TriStar) já calculado no Postgres
// (via endpoint HTTPS da VM). Zero regra de negócio aqui — o backend manda pronto.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import https from 'https'

export interface ControleItem {
  transportadora: 'MILE' | 'TRISTAR'
  rastreio: string
  invoice: string
  cliente: string
  telefone: string
  dataEnvio: string            // ISO
  etapaNum: number             // 0 a 7
  etapa: string                // nome da etapa
  codigoOriginal: string
  ultimaMovimentacao: string   // ISO
  diasDesdeEnvio: number
  diasParado: number
  criticidade: 'critico' | 'atencao' | 'ok'
}

// Mesma API do estoque, path /controle. Usa ESTOQUE_CONTROLE_URL se existir; senão
// deriva de ESTOQUE_API_URL trocando o sufixo /estoque por /controle.
const BASE = process.env.ESTOQUE_API_URL || 'https://173.254.245.217:8443/estoque'
const API_URL = process.env.ESTOQUE_CONTROLE_URL || BASE.replace(/\/estoque$/, '/controle')
const API_KEY = process.env.ESTOQUE_API_KEY || ''

function fetchControle(): Promise<Record<string, unknown>[]> {
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

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const rows = await fetchControle()
    const itens: ControleItem[] = rows.map(r => ({
      transportadora: r.transportadora === 'TRISTAR' ? 'TRISTAR' : 'MILE',
      rastreio: s(r.rastreio),
      invoice: s(r.invoice),
      cliente: s(r.cliente),
      telefone: s(r.telefone),
      dataEnvio: s(r.data_envio),
      etapaNum: n(r.etapa_num),
      etapa: s(r.etapa),
      codigoOriginal: s(r.codigo_original),
      ultimaMovimentacao: s(r.ultima_movimentacao),
      diasDesdeEnvio: n(r.dias_desde_envio),
      diasParado: n(r.dias_parado),
      criticidade: r.criticidade === 'critico' ? 'critico' : r.criticidade === 'atencao' ? 'atencao' : 'ok',
    }))
    return NextResponse.json({ itens }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
