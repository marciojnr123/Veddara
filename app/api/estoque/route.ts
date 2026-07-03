import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'

export interface EstoqueItem {
  sku: string
  produto: string
  atual: number
  reservado: number
  disponivel: number
  minimo: number
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => String(v ?? '').trim()

// Fase 1: estoque físico da Mile ao vivo (por SKU).
// Próximas fases cruzam vendas / integração quando as tabelas estiverem no Data Service.
export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const q = await agentQuery(`
      SELECT SKU_PRODUTO, DS_PRODUTO, QT_ESTOQUE_ATUAL, QT_ESTOQUE_RESERVADO, QT_ESTOQUE_REAL, QT_ESTOQUE_MINIMO
      FROM veddara.TB_MILE_EXPRESS_ESTOQUE
      ORDER BY DS_PRODUTO`, 5000)
    const itens: EstoqueItem[] = q.rows.map(r => ({
      sku: str(r[0]),
      produto: str(r[1]),
      atual: num(r[2]),
      reservado: num(r[3]),
      disponivel: num(r[4]),
      minimo: num(r[5]),
    })).filter(x => x.sku || x.produto)
    return NextResponse.json({ itens }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
