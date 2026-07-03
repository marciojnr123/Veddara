import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'
import { fetchSheet, numBR } from '@/lib/sheets'

export interface EstoqueItem {
  sku: string
  produto: string
  atual: number
  reservado: number
  disponivel: number
  minimo: number
  vendasSemInt: number
  compras: number
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => String(v ?? '').trim()

const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'
const BASE_VENDAS = '2025-08-01'
// Planilha de Compras (aba "Compras": Product Id | Descrição | Custo | Qtde | Total | Data | SKU)
const SHEET_COMPRAS_ID = '1SalDB0AuYAVIWGV8OYMJQ5EZQ8ZKXJNLAeGHDcRDnds'

const SQL_MILE = `
  SELECT e.SKU_PRODUTO, e.DS_PRODUTO, e.QT_ESTOQUE_ATUAL, e.QT_ESTOQUE_RESERVADO, e.QT_ESTOQUE_REAL, e.QT_ESTOQUE_MINIMO
  FROM veddara.TB_MILE_EXPRESS_ESTOQUE e
  JOIN (SELECT SKU_PRODUTO, MAX(DT_ESTOQUE) AS mx FROM veddara.TB_MILE_EXPRESS_ESTOQUE GROUP BY SKU_PRODUTO) m
    ON m.SKU_PRODUTO = e.SKU_PRODUTO AND m.mx = e.DT_ESTOQUE
  ORDER BY e.DS_PRODUTO`

const SQL_VENDAS_SEM_INT = `
  SELECT pp.FactoryCode AS sku, SUM(ii.Quantity) AS qtd
  FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
  JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON ii.OrderId = io.Id
  JOIN veddara.EZ_VEDDARA_PRODUCT_PRODUCT pp ON pp.Id = ii.ProductId
  JOIN veddara.EZ_VEDDARA_SALE_SALESPERSON sp ON sp.Id = io.SalespersonId
  WHERE io.SystemCustomerId = '${EMPRESA_ID}'
    AND io.Status IN (1, 100)
    AND io.DateInvoiceOrder >= '${BASE_VENDAS}'
    AND sp.Firstname NOT IN ('CANNACARE', 'CANNECT ', 'FLEXUS SOLUTION LLC')
    AND pp.FactoryCode IS NOT NULL
    AND CAST(io.OrderId AS VARCHAR(20)) NOT IN (
      SELECT RTRIM(CAST(cp.CD_PEDIDO AS VARCHAR(20))) FROM veddara.TB_MILE_EXPRESS_CONTROLE_PEDIDO cp
      WHERE cp.CD_STATUS = 'TRANSMITIDO' AND cp.CD_PEDIDO IS NOT NULL
    )
  GROUP BY pp.FactoryCode`

// Compras da planilha (por Product Id) mapeadas pra SKU (FactoryCode) via PRODUCT_PRODUCT
async function comprasPorSku(): Promise<Map<string, number>> {
  const rows = await fetchSheet(SHEET_COMPRAS_ID, 'Compras')
  const porPid = new Map<string, number>()
  for (let r = 1; r < rows.length; r++) {
    const pid = (rows[r][0] || '').trim()
    if (!pid) continue
    porPid.set(pid, (porPid.get(pid) ?? 0) + numBR(rows[r][3] || ''))
  }
  if (porPid.size === 0) return new Map()

  const rp = await agentQuery(
    `SELECT pp.ProductId, pp.FactoryCode FROM veddara.EZ_VEDDARA_PRODUCT_PRODUCT pp
     WHERE pp.SystemCustomerId = '${EMPRESA_ID}' AND pp.FactoryCode IS NOT NULL`, 20000)
  const pid2sku = new Map<string, string>()
  for (const row of rp.rows) pid2sku.set(str(row[0]), str(row[1]))

  const porSku = new Map<string, number>()
  for (const [pid, q] of porPid) {
    const sku = pid2sku.get(pid)
    if (sku) porSku.set(sku, (porSku.get(sku) ?? 0) + q)
  }
  return porSku
}

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const [rMile, rVendas, rCompras] = await Promise.allSettled([
      agentQuery(SQL_MILE, 5000),
      agentQuery(SQL_VENDAS_SEM_INT, 5000),
      comprasPorSku(),
    ])

    if (rMile.status !== 'fulfilled') {
      const e = rMile.reason
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }

    const vendasMap = new Map<string, number>()
    let vendasErro: string | null = null
    if (rVendas.status === 'fulfilled') {
      for (const r of rVendas.value.rows) vendasMap.set(str(r[0]), num(r[1]))
    } else {
      vendasErro = rVendas.reason instanceof Error ? rVendas.reason.message : String(rVendas.reason)
    }

    const comprasMap: Map<string, number> = rCompras.status === 'fulfilled' ? rCompras.value : new Map()
    const comprasErro: string | null = rCompras.status === 'fulfilled'
      ? null
      : (rCompras.reason instanceof Error ? rCompras.reason.message : String(rCompras.reason))

    const vistos = new Set<string>()
    const itens: EstoqueItem[] = []
    for (const r of rMile.value.rows) {
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
        vendasSemInt: vendasMap.get(sku) ?? 0,
        compras: comprasMap.get(sku) ?? 0,
      })
    }

    return NextResponse.json({ itens, vendasErro, comprasErro }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
