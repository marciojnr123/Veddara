import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'

export interface DetalheVendedor {
  mensal: Array<{ anomes: string; fat: number }>
  fatMesAtual: number
  novos: number
  recompra: number
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => String(v ?? '').trim()

const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'
const ST = 'Status IN (1, 100)'
const ITEMF = 'AND ii.Status = 1 AND ii.ItemCode >= 1'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9A-Fa-f-]{8,40}$/
function validData(s: string | null): string | null {
  if (!s || !DATE_RE.test(s)) return null
  const d = new Date(s + 'T00:00:00'); return Number.isNaN(d.getTime()) ? null : s
}
function toISO(d: Date): string { return d.toISOString().slice(0, 10) }

export async function GET(req: NextRequest) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = str(searchParams.get('id'))
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const inicio = validData(searchParams.get('inicio'))
  const fim = validData(searchParams.get('fim'))
  const temFiltro = !!(inicio && fim)
  const fimMais1 = fim ? toISO(new Date(new Date(fim + 'T00:00:00').getTime() + 86400000)) : null
  const fInvoice = temFiltro
    ? `AND io.DateInvoiceOrder >= '${inicio}' AND io.DateInvoiceOrder < '${fimMais1}'`
    : `AND io.DateInvoiceOrder >= '2024-07-01'`

  const hoje = new Date()
  const mesIni = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`

  const base = `FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
    JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
    WHERE io.${ST} ${ITEMF} AND io.SystemCustomerId = '${EMPRESA_ID}' AND io.SalespersonId = '${id}'`

  try {
    const [qMensal, qMes, qNR] = await Promise.all([
      // faturamento por mês do vendedor (para "melhor mês")
      agentQuery(`SELECT YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder) AS anomes,
                         SUM(ii.TOTAL_SALE_PRICE) AS fat
                  ${base} ${fInvoice}
                  GROUP BY YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder)
                  ORDER BY anomes`, 500),
      // faturamento do mês atual (para a meta B2C)
      agentQuery(`SELECT SUM(ii.TOTAL_SALE_PRICE) AS fat ${base} AND io.DateInvoiceOrder >= '${mesIni}'`, 10),
      // clientes do vendedor: novos (compraram em 1 mês) x recompra (em mais de 1 mês)
      agentQuery(`
        SELECT SUM(CASE WHEN meses > 1 THEN 1 ELSE 0 END) AS recompra,
               SUM(CASE WHEN meses = 1 THEN 1 ELSE 0 END) AS novos
        FROM (
          SELECT io.CustomerId, COUNT(DISTINCT YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder)) AS meses
          FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
          WHERE io.${ST} AND io.SystemCustomerId = '${EMPRESA_ID}' AND io.SalespersonId = '${id}'
          GROUP BY io.CustomerId
        ) t`, 10),
    ])

    const dados: DetalheVendedor = {
      mensal: qMensal.rows.map(r => ({ anomes: str(r[0]), fat: num(r[1]) })).filter(x => x.anomes),
      fatMesAtual: num(qMes.rows[0]?.[0]),
      recompra: num(qNR.rows[0]?.[0]),
      novos: num(qNR.rows[0]?.[1]),
    }
    return NextResponse.json(dados)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
