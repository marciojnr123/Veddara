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
    // A tabela guarda histórico por data (DT_ESTOQUE) → pegamos só o snapshot
    // MAIS RECENTE de cada SKU (senão o mesmo produto aparece repetido).
    const q = await agentQuery(`
      SELECT e.SKU_PRODUTO, e.DS_PRODUTO, e.QT_ESTOQUE_ATUAL, e.QT_ESTOQUE_RESERVADO, e.QT_ESTOQUE_REAL, e.QT_ESTOQUE_MINIMO
      FROM veddara.TB_MILE_EXPRESS_ESTOQUE e
      JOIN (
        SELECT SKU_PRODUTO, MAX(DT_ESTOQUE) AS mx
        FROM veddara.TB_MILE_EXPRESS_ESTOQUE
        GROUP BY SKU_PRODUTO
      ) m ON m.SKU_PRODUTO = e.SKU_PRODUTO AND m.mx = e.DT_ESTOQUE
      ORDER BY e.DS_PRODUTO`, 5000)

    // Trava extra: garante 1 linha por SKU (caso haja +1 registro na mesma data)
    const vistos = new Set<string>()
    const itens: EstoqueItem[] = []
    for (const r of q.rows) {
      const sku = str(r[0])
      const chave = sku || str(r[1])
      if (vistos.has(chave)) continue
      vistos.add(chave)
      itens.push({
        sku,
        produto: str(r[1]),
        atual: num(r[2]),
        reservado: num(r[3]),
        disponivel: num(r[4]),
        minimo: num(r[5]),
      })
    }
    return NextResponse.json({ itens }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
