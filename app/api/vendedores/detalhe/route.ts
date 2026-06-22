import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'

export interface DetalheVendedor {
  mensal: Array<{ anomes: string; fat: number }>
  fatMesAtual: number
  novos: number
  recompra: number
  // evolução diária (acumulada no front) do mês de referência: vendedor vs categoria
  evolucaoMes: {
    ano: number
    mes: number
    diasNoMes: number
    catN: number               // nº de vendedores na categoria (p/ média)
    vendedorDia: Array<{ dia: number; fat: number }>
    categoriaDia: Array<{ dia: number; fat: number }>  // SOMA da categoria por dia
  }
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => String(v ?? '').trim()

const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'
const ST = 'Status IN (1, 100)'
const ITEMF = 'AND ii.Status = 1 AND ii.ItemCode >= 1'

const UUID_RE = /^[0-9A-Fa-f-]{8,40}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
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
  const periodo = temFiltro ? `AND io.DateInvoiceOrder >= '${inicio}' AND io.DateInvoiceOrder < '${fimMais1}'` : ''
  const anomesIni = temFiltro && inicio ? Number(inicio.slice(0, 4)) * 100 + Number(inicio.slice(5, 7)) : 0

  // melhor mês = histórico completo; novos×recompra respeita o filtro de data
  const hoje = new Date()
  const mesIni = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`

  // ── Mês de referência da evolução diária ──
  // mês do filtro (quando é 1 mês só) ou o mês atual
  let mAno: number, mMes: number
  if (temFiltro && inicio && fim && inicio.slice(0, 7) === fim.slice(0, 7)) {
    mAno = Number(inicio.slice(0, 4)); mMes = Number(inicio.slice(5, 7))
  } else {
    mAno = hoje.getFullYear(); mMes = hoje.getMonth() + 1
  }
  const mIni = `${mAno}-${String(mMes).padStart(2, '0')}-01`
  const mFimMais1 = mMes === 12 ? `${mAno + 1}-01-01` : `${mAno}-${String(mMes + 1).padStart(2, '0')}-01`
  const diasNoMes = new Date(mAno, mMes, 0).getDate()

  // ids da mesma categoria (para a média), validados como UUID
  const catIds = (searchParams.get('catIds') || '').split(',').map(s => s.trim()).filter(s => UUID_RE.test(s))
  const catN = catIds.length
  const catInList = catIds.map(x => `'${x}'`).join(',')

  const baseDia = `FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
    JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
    WHERE io.${ST} ${ITEMF} AND io.SystemCustomerId = '${EMPRESA_ID}'
      AND io.DateInvoiceOrder >= '${mIni}' AND io.DateInvoiceOrder < '${mFimMais1}'`

  const base = `FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
    JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
    WHERE io.${ST} ${ITEMF} AND io.SystemCustomerId = '${EMPRESA_ID}' AND io.SalespersonId = '${id}'`

  // novos × recompra: com filtro → novo = 1ª compra do cliente (c/ este vendedor) dentro
  // do período; recompra = já comprava antes. Sem filtro → 1 mês = novo, 2+ = recompra.
  const qNRSql = temFiltro ? `
    SELECT SUM(CASE WHEN f.fa < ${anomesIni} THEN 1 ELSE 0 END) AS recompra,
           SUM(CASE WHEN f.fa >= ${anomesIni} THEN 1 ELSE 0 END) AS novos
    FROM (
      SELECT DISTINCT io.CustomerId AS cid
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
      WHERE io.${ST} AND io.SystemCustomerId = '${EMPRESA_ID}' AND io.SalespersonId = '${id}' ${periodo}
    ) m
    JOIN (
      SELECT io2.CustomerId AS cid, MIN(YEAR(io2.DateInvoiceOrder)*100 + MONTH(io2.DateInvoiceOrder)) AS fa
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io2
      WHERE io2.${ST} AND io2.SystemCustomerId = '${EMPRESA_ID}' AND io2.SalespersonId = '${id}'
      GROUP BY io2.CustomerId
    ) f ON f.cid = m.cid` : `
    SELECT SUM(CASE WHEN meses > 1 THEN 1 ELSE 0 END) AS recompra,
           SUM(CASE WHEN meses = 1 THEN 1 ELSE 0 END) AS novos
    FROM (
      SELECT io.CustomerId, COUNT(DISTINCT YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder)) AS meses
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
      WHERE io.${ST} AND io.SystemCustomerId = '${EMPRESA_ID}' AND io.SalespersonId = '${id}'
      GROUP BY io.CustomerId
    ) t`

  // faturamento por dia do mês de referência (vendedor; e categoria)
  const DIA_SEL = 'DAY(io.DateInvoiceOrder) AS dia, SUM(ii.TOTAL_SALE_PRICE) AS fat'
  const qDiaVendSql = `SELECT ${DIA_SEL} ${baseDia} AND io.SalespersonId = '${id}'
                       GROUP BY DAY(io.DateInvoiceOrder) ORDER BY dia`
  const qDiaCatSql = catN > 0
    ? `SELECT ${DIA_SEL} ${baseDia} AND io.SalespersonId IN (${catInList})
       GROUP BY DAY(io.DateInvoiceOrder) ORDER BY dia`
    : null

  try {
    const queries = [
      // faturamento por mês do vendedor (para "melhor mês") — SEMPRE histórico
      // completo, NÃO afetado pelo filtro de data da tela
      agentQuery(`SELECT YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder) AS anomes,
                         SUM(ii.TOTAL_SALE_PRICE) AS fat
                  ${base}
                  GROUP BY YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder)
                  ORDER BY anomes`, 500),
      // faturamento do mês atual (para a meta B2C)
      agentQuery(`SELECT SUM(ii.TOTAL_SALE_PRICE) AS fat ${base} AND io.DateInvoiceOrder >= '${mesIni}'`, 10),
      // clientes do vendedor: novos × recompra (respeita o filtro de data)
      agentQuery(qNRSql, 10),
      // evolução diária do vendedor no mês de referência
      agentQuery(qDiaVendSql, 100),
    ]
    if (qDiaCatSql) queries.push(agentQuery(qDiaCatSql, 100))

    const res = await Promise.all(queries)
    const [qMensal, qMes, qNR, qDiaVend] = res
    const qDiaCat = qDiaCatSql ? res[4] : null

    const dados: DetalheVendedor = {
      mensal: qMensal.rows.map(r => ({ anomes: str(r[0]), fat: num(r[1]) })).filter(x => x.anomes),
      fatMesAtual: num(qMes.rows[0]?.[0]),
      recompra: num(qNR.rows[0]?.[0]),
      novos: num(qNR.rows[0]?.[1]),
      evolucaoMes: {
        ano: mAno, mes: mMes, diasNoMes, catN,
        vendedorDia: qDiaVend.rows.map(r => ({ dia: num(r[0]), fat: num(r[1]) })),
        categoriaDia: qDiaCat ? qDiaCat.rows.map(r => ({ dia: num(r[0]), fat: num(r[1]) })) : [],
      },
    }
    return NextResponse.json(dados)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
