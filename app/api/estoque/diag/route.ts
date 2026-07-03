import { NextRequest, NextResponse } from 'next/server'
import { agentQuery } from '@/lib/agent'
import { requireAuth } from '@/lib/api-auth'

// Diagnóstico (admin) — testa acesso às tabelas necessárias pro Estoque.
// Abrir em /api/estoque/diag logado como admin. NÃO é usado pelo dashboard.
async function probe(nome: string, sql: string) {
  try {
    const r = await agentQuery(sql, 3)
    return { nome, ok: true, colunas: r.columns, amostra: r.rows }
  } catch (e) {
    return { nome, ok: false, erro: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, ['admin'])
  if (auth instanceof NextResponse) return auth

  const probes = await Promise.all([
    // colunas do item da nota — procurar um código/SKU pra cruzar com a Mile
    probe('Invoice item (colunas)', `SELECT TOP 1 * FROM veddara.EZ_VEDDARA_INVOICE_ITEM`),
    // nomes alternativos da tabela de produto
    probe('Produto (nome alt: EZ_VEDDARA_PRODUCT)', `SELECT TOP 1 * FROM veddara.EZ_VEDDARA_PRODUCT`),
    probe('Produto (nome alt: EZ_VEDDARA_PRODUCT_ITEM)', `SELECT TOP 1 * FROM veddara.EZ_VEDDARA_PRODUCT_ITEM`),
    // continua confirmando os transmitidos (caso você carregue depois)
    probe('Mile controle pedido (transmitidos)', `SELECT TOP 3 * FROM veddara.TB_MILE_EXPRESS_CONTROLE_PEDIDO`),
  ])

  return NextResponse.json({ probes }, { headers: { 'Cache-Control': 'no-store' } })
}
