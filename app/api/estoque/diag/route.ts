import { NextRequest, NextResponse } from 'next/server'
import { agentQuery } from '@/lib/agent'
import { requireAuth } from '@/lib/api-auth'

// Diagnóstico (admin) do produto 87 — por que o Est. Mile deu 0 no dashboard e 6 no relatório?
const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'

async function probe(nome: string, sql: string) {
  try {
    const r = await agentQuery(sql, 20)
    return { nome, ok: true, colunas: r.columns, linhas: r.rows }
  } catch (e) {
    return { nome, ok: false, erro: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, ['admin'])
  if (auth instanceof NextResponse) return auth

  const probes = await Promise.all([
    // 1) o que a tabela de produto tem pro ProductId 87 (FactoryCode x Barcode)
    probe('Produto 87 (FactoryCode/Barcode)', `
      SELECT pp.ProductId, pp.FactoryCode, pp.Barcode, pp.Description
      FROM veddara.EZ_VEDDARA_PRODUCT_PRODUCT pp
      WHERE pp.SystemCustomerId = '${EMPRESA_ID}' AND pp.ProductId = '87'`),
    // 2) a Mile tem o SKU que está na planilha master (810068551235)?
    probe('Mile pelo SKU da master (810068551235)', `
      SELECT SKU_PRODUTO, DS_PRODUTO, QT_ESTOQUE_ATUAL, DT_ESTOQUE
      FROM veddara.TB_MILE_EXPRESS_ESTOQUE WHERE SKU_PRODUTO = '810068551235'`),
    // 3) a Mile tem esse produto com algum OUTRO SKU? (busca pela descrição)
    probe('Mile por descrição (2700MG)', `
      SELECT SKU_PRODUTO, DS_PRODUTO, QT_ESTOQUE_ATUAL, DT_ESTOQUE
      FROM veddara.TB_MILE_EXPRESS_ESTOQUE WHERE UPPER(DS_PRODUTO) LIKE '%2700%'`),
  ])

  return NextResponse.json({ probes }, { headers: { 'Cache-Control': 'no-store' } })
}
