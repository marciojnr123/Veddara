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
  vendasSemInt: number
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => String(v ?? '').trim()

const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'
// data base das "vendas sem integração" (igual ao relatório)
const BASE_VENDAS = '2025-08-01'

// Estoque físico Mile — só o snapshot mais recente de cada SKU
const SQL_MILE = `
  SELECT e.SKU_PRODUTO, e.DS_PRODUTO, e.QT_ESTOQUE_ATUAL, e.QT_ESTOQUE_RESERVADO, e.QT_ESTOQUE_REAL, e.QT_ESTOQUE_MINIMO
  FROM veddara.TB_MILE_EXPRESS_ESTOQUE e
  JOIN (SELECT SKU_PRODUTO, MAX(DT_ESTOQUE) AS mx FROM veddara.TB_MILE_EXPRESS_ESTOQUE GROUP BY SKU_PRODUTO) m
    ON m.SKU_PRODUTO = e.SKU_PRODUTO AND m.mx = e.DT_ESTOQUE
  ORDER BY e.DS_PRODUTO`

// Vendas SEM integração, por SKU (FactoryCode):
//  - nota faturada (Status 1/100), empresa Veddara, a partir da data base
//  - pedido NÃO transmitido para a Mile
//  - exclui parceiros (Cannacare/Cannect/Flexus)
//  - frete cai fora sozinho (ProductId null não casa no join de produto)
//  Falta ainda: excluir "Acertos" e "Erros Integração" (virão das planilhas).
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
      SELECT cp.CD_PEDIDO FROM veddara.TB_MILE_EXPRESS_CONTROLE_PEDIDO cp
      WHERE cp.CD_STATUS = 'TRANSMITIDO' AND cp.CD_PEDIDO IS NOT NULL
    )
  GROUP BY pp.FactoryCode`

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    // Mile é obrigatório; vendas é "melhor esforço" (se falhar, mostramos só o estoque)
    const [rMile, rVendas] = await Promise.allSettled([
      agentQuery(SQL_MILE, 5000),
      agentQuery(SQL_VENDAS_SEM_INT, 5000),
    ])

    if (rMile.status !== 'fulfilled') {
      const e = rMile.reason
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }

    // vendas sem integração por SKU
    const vendasMap = new Map<string, number>()
    let vendasErro: string | null = null
    if (rVendas.status === 'fulfilled') {
      for (const r of rVendas.value.rows) vendasMap.set(str(r[0]), num(r[1]))
    } else {
      vendasErro = rVendas.reason instanceof Error ? rVendas.reason.message : String(rVendas.reason)
    }

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
      })
    }

    return NextResponse.json({ itens, vendasErro }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
