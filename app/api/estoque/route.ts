import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'
import { fetchSheet, numBR } from '@/lib/sheets'

export interface EstoqueItem {
  productId: string
  sku: string
  produto: string
  atual: number
  reservado: number
  disponivel: number
  minimo: number
  vendasSemInt: number
  compras: number
  inicial: number
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => String(v ?? '').trim()

const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'
const BASE_VENDAS = '2025-08-01'
// Planilhas
const SHEET_MASTER_ID = '18izoV6xD2sbzLq3zBKqGpX2L6pzhI3S4eYtRApMVuqQ' // aba 1: Product Id | Descrição | Marca | ... | Lote | Estoque Inicial
const SHEET_COMPRAS_ID = '1SalDB0AuYAVIWGV8OYMJQ5EZQ8ZKXJNLAeGHDcRDnds' // aba "Compras": Product Id | ... | Qtde | ...

const SQL_MILE = `
  SELECT e.SKU_PRODUTO, e.DS_PRODUTO, e.QT_ESTOQUE_ATUAL, e.QT_ESTOQUE_RESERVADO, e.QT_ESTOQUE_REAL, e.QT_ESTOQUE_MINIMO
  FROM veddara.TB_MILE_EXPRESS_ESTOQUE e
  JOIN (SELECT SKU_PRODUTO, MAX(DT_ESTOQUE) AS mx FROM veddara.TB_MILE_EXPRESS_ESTOQUE GROUP BY SKU_PRODUTO) m
    ON m.SKU_PRODUTO = e.SKU_PRODUTO AND m.mx = e.DT_ESTOQUE`

// Vendas SEM integração, por Product Id (pp.ProductId), a partir da data base.
const SQL_VENDAS_SEM_INT = `
  SELECT pp.ProductId AS pid, SUM(ii.Quantity) AS qtd
  FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
  JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON ii.OrderId = io.Id
  JOIN veddara.EZ_VEDDARA_PRODUCT_PRODUCT pp ON pp.Id = ii.ProductId
  JOIN veddara.EZ_VEDDARA_SALE_SALESPERSON sp ON sp.Id = io.SalespersonId
  WHERE io.SystemCustomerId = '${EMPRESA_ID}'
    AND io.Status IN (1, 100)
    AND io.DateInvoiceOrder >= '${BASE_VENDAS}'
    AND sp.Firstname NOT IN ('CANNACARE', 'CANNECT ', 'FLEXUS SOLUTION LLC')
    AND CAST(io.OrderId AS VARCHAR(20)) NOT IN (
      SELECT RTRIM(CAST(cp.CD_PEDIDO AS VARCHAR(20))) FROM veddara.TB_MILE_EXPRESS_CONTROLE_PEDIDO cp
      WHERE cp.CD_STATUS = 'TRANSMITIDO' AND cp.CD_PEDIDO IS NOT NULL
    )
  GROUP BY pp.ProductId`

// Compras da planilha, somadas por Product Id
async function comprasPorProductId(): Promise<Map<string, number>> {
  const rows = await fetchSheet(SHEET_COMPRAS_ID, 'Compras')
  const m = new Map<string, number>()
  for (let r = 1; r < rows.length; r++) {
    const pid = (rows[r][0] || '').trim()
    if (!pid) continue
    m.set(pid, (m.get(pid) ?? 0) + numBR(rows[r][3] || ''))
  }
  return m
}

// Lista oficial de produtos = aba 1 da planilha master
async function produtosMaster() {
  const rows = await fetchSheet(SHEET_MASTER_ID)
  const out: Array<{ productId: string; produto: string; sku: string; inicial: number }> = []
  const vistos = new Set<string>()
  for (let r = 1; r < rows.length; r++) {
    const productId = (rows[r][0] || '').trim()
    if (!productId || vistos.has(productId)) continue
    vistos.add(productId)
    out.push({
      productId,
      produto: (rows[r][1] || '').trim(),
      sku: (rows[r][7] || '').trim(),
      inicial: numBR(rows[r][8] || ''),
    })
  }
  return out
}

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const [rMaster, rMile, rVendas, rCompras] = await Promise.allSettled([
      produtosMaster(),
      agentQuery(SQL_MILE, 8000),
      agentQuery(SQL_VENDAS_SEM_INT, 5000),
      comprasPorProductId(),
    ])

    if (rMaster.status !== 'fulfilled') {
      const e = rMaster.reason
      return NextResponse.json({ error: 'Falha ao ler a planilha master: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 })
    }

    // Mile por SKU (só o snapshot mais recente já vem da query; dedup extra por SKU)
    const mileMap = new Map<string, { atual: number; reservado: number; disponivel: number; minimo: number }>()
    if (rMile.status === 'fulfilled') {
      for (const r of rMile.value.rows) {
        const sku = str(r[0])
        if (!sku || mileMap.has(sku)) continue
        mileMap.set(sku, { atual: num(r[2]), reservado: num(r[3]), disponivel: num(r[4]), minimo: num(r[5]) })
      }
    }
    const mileErro = rMile.status === 'fulfilled' ? null : (rMile.reason instanceof Error ? rMile.reason.message : String(rMile.reason))

    const vendasMap = new Map<string, number>()
    if (rVendas.status === 'fulfilled') for (const r of rVendas.value.rows) vendasMap.set(str(r[0]), num(r[1]))
    const vendasErro = rVendas.status === 'fulfilled' ? null : (rVendas.reason instanceof Error ? rVendas.reason.message : String(rVendas.reason))

    const comprasMap: Map<string, number> = rCompras.status === 'fulfilled' ? rCompras.value : new Map()
    const comprasErro = rCompras.status === 'fulfilled' ? null : (rCompras.reason instanceof Error ? rCompras.reason.message : String(rCompras.reason))

    const itens: EstoqueItem[] = rMaster.value.map(p => {
      const mile = mileMap.get(p.sku)
      return {
        productId: p.productId,
        sku: p.sku,
        produto: p.produto,
        atual: mile?.atual ?? 0,
        reservado: mile?.reservado ?? 0,
        disponivel: mile?.disponivel ?? 0,
        minimo: mile?.minimo ?? 0,
        vendasSemInt: vendasMap.get(p.productId) ?? 0,
        compras: comprasMap.get(p.productId) ?? 0,
        inicial: p.inicial,
      }
    })

    return NextResponse.json({ itens, mileErro, vendasErro, comprasErro }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
