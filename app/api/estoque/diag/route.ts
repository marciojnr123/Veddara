import { NextRequest, NextResponse } from 'next/server'
import { agentQuery } from '@/lib/agent'
import { requireAuth } from '@/lib/api-auth'

// Diagnóstico (admin) — checa se a invoice é "venda consignada" e está sendo excluída.
const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'
const CONSIGNADA_HEX = '8D64213D82F64353A325CD3CD0F7988D'

async function probe(nome: string, sql: string) {
  try {
    const r = await agentQuery(sql, 30)
    return { nome, ok: true, colunas: r.columns, linhas: r.rows }
  } catch (e) {
    return { nome, ok: false, erro: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, ['admin'])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const inv = (searchParams.get('inv') || '11401').replace(/[^\d]/g, '')

  const probes = await Promise.all([
    // Cabeçalho do pedido: PaymentTermId + se bate com o UUID de consignada
    probe(`Pedido ${inv} (PaymentTermId)`, `
      SELECT io.OrderId, io.PaymentTermId,
             UPPER(REPLACE(CAST(io.PaymentTermId AS VARCHAR(64)), '-', '')) AS pt_hex,
             CASE WHEN UPPER(REPLACE(CAST(io.PaymentTermId AS VARCHAR(64)), '-', '')) = '${CONSIGNADA_HEX}' THEN 'SIM (consignada)' ELSE 'nao' END AS eh_consignada,
             io.Status, io.DateInvoiceOrder
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
      WHERE io.SystemCustomerId = '${EMPRESA_ID}' AND io.OrderId = ${inv}`),
    // Itens da nota (produto + quantidade)
    probe(`Itens do pedido ${inv}`, `
      SELECT pp.ProductId, ii.Description, ii.Quantity, pp.FactoryCode
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
      JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON ii.OrderId = io.Id
      LEFT JOIN veddara.EZ_VEDDARA_PRODUCT_PRODUCT pp ON pp.Id = ii.ProductId
      WHERE io.SystemCustomerId = '${EMPRESA_ID}' AND io.OrderId = ${inv}`),
  ])

  return NextResponse.json({ invoice: inv, probes }, { headers: { 'Cache-Control': 'no-store' } })
}
