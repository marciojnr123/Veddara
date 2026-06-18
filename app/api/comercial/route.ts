import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'

export interface DadosComercial {
  periodo: { inicio: string | null; fim: string | null }
  kpis: {
    faturamentoPeriodo: number
    faturamentoAnterior: number
    crescimentoPoP: number
    notasPeriodo: number
    pipelineAberto: number
    pipelineQtd: number
    clientesAtivos: number
    ticketMedio: number
    winRate: number
  }
  mensal: Array<{ anomes: string; faturamento: number; notas: number }>
  diario: Array<{ dia: string; faturamento: number; notas: number }>
  granularidade: 'mensal' | 'diario'
  anual: Array<{ ano: string; faturamento: number; notas: number }>
  topClientes: Array<{ nome: string; faturamento: number; notas: number }>
  topVendedores: Array<{ nome: string; faturamento: number; notas: number }>
  topProdutos: Array<{ nome: string; faturamento: number }>
  funil: { convertidos: number; perdidos: number; abertos: number; valorPipeline: number }
  novosClientes: Array<{ ano: string; qtd: number }>
}

// Faturamento alinhado ao relatório do BI: nota com Status 1 ou 100 (inclui
// pendentes/NF 999999), item com Status 1 e ItemCode >= 1 (inclui frete,
// exclui linhas de item inválidas).
const ST = 'Status IN (1, 100)'
const ITEMF = 'AND ii.Status = 1 AND ii.ItemCode >= 1'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown): string => String(v ?? '').trim()

// Valida formato YYYY-MM-DD (evita injeção de SQL)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function validData(s: string | null): string | null {
  if (!s || !DATE_RE.test(s)) return null
  const d = new Date(s + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : s
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const inicio = validData(searchParams.get('inicio'))
  const fim = validData(searchParams.get('fim'))
  const temFiltro = !!(inicio && fim)
  // período de um único mês (filtro "Mês" ou DE/ATÉ dentro do mesmo mês) → usa faturamento diário
  const mesUnico = !!(inicio && fim && inicio.slice(0, 7) === fim.slice(0, 7))

  // Cláusula de período para colunas de data (data inclusiva no fim com +1 dia)
  const fimMais1 = fim ? toISO(new Date(new Date(fim + 'T00:00:00').getTime() + 86400000)) : null
  const fInvoice = temFiltro ? `AND io.DateInvoiceOrder >= '${inicio}' AND io.DateInvoiceOrder < '${fimMais1}'` : ''
  const fEstimate = temFiltro ? `AND eo.DateEstimateOrder >= '${inicio}' AND eo.DateEstimateOrder < '${fimMais1}'` : ''
  const fCliente = temFiltro ? `AND CreateDate >= '${inicio}' AND CreateDate < '${fimMais1}'` : ''

  // Período anterior de mesma duração (para comparação PoP), só quando há filtro
  let prevInicio: string | null = null, prevFim: string | null = null
  if (temFiltro) {
    const di = new Date(inicio + 'T00:00:00')
    const df = new Date(fim + 'T00:00:00')
    const dur = df.getTime() - di.getTime()
    prevFim = toISO(new Date(di.getTime() - 86400000))
    prevInicio = toISO(new Date(di.getTime() - 86400000 - dur))
  }

  // Mensal: dentro do filtro, ou últimos ~24 meses por padrão
  const fMensal = temFiltro
    ? `AND io.DateInvoiceOrder >= '${inicio}' AND io.DateInvoiceOrder < '${fimMais1}'`
    : `AND io.DateInvoiceOrder >= '2024-07-01'`

  try {
    const queries = [
      // 0: faturamento + notas do período
      agentQuery(`
        SELECT SUM(ii.TOTAL_SALE_PRICE) AS fat, COUNT(DISTINCT io.Id) AS notas
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        WHERE io.${ST} ${ITEMF} ${fInvoice}`, 10),
      // 1: faturamento anual
      agentQuery(`
        SELECT YEAR(io.DateInvoiceOrder) AS ano, SUM(ii.TOTAL_SALE_PRICE) AS fat, COUNT(DISTINCT io.Id) AS notas
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        WHERE io.${ST} ${ITEMF} ${fInvoice}
        GROUP BY YEAR(io.DateInvoiceOrder)
        ORDER BY ano`, 100),
      // 2: faturamento mensal
      agentQuery(`
        SELECT YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder) AS anomes,
               SUM(ii.TOTAL_SALE_PRICE) AS fat, COUNT(DISTINCT io.Id) AS notas
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        WHERE io.${ST} ${ITEMF} ${fMensal}
        GROUP BY YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder)
        ORDER BY anomes`, 200),
      // 3: top clientes
      agentQuery(`
        SELECT TOP 10 c.Name AS nome, SUM(ii.TOTAL_SALE_PRICE) AS fat, COUNT(DISTINCT io.Id) AS notas
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        JOIN veddara.EZ_VEDDARA_CUSTOMER_CUSTOMER c ON io.CustomerId = c.Id
        WHERE io.${ST} ${ITEMF} ${fInvoice}
        GROUP BY c.Name
        ORDER BY fat DESC`, 50),
      // 4: top vendedores
      agentQuery(`
        SELECT TOP 10 sp.Firstname || ' ' || ISNULL(sp.LastName, '') AS nome,
               SUM(ii.TOTAL_SALE_PRICE) AS fat, COUNT(DISTINCT io.Id) AS notas
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        JOIN veddara.EZ_VEDDARA_SALE_SALESPERSON sp ON io.SalespersonId = sp.Id
        WHERE io.${ST} ${ITEMF} ${fInvoice}
        GROUP BY sp.Firstname, sp.LastName
        ORDER BY fat DESC`, 50),
      // 5: top produtos
      agentQuery(`
        SELECT TOP 10 ii.Description AS nome, SUM(ii.TOTAL_SALE_PRICE) AS fat
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        WHERE io.${ST} ${ITEMF} ${fInvoice}
        GROUP BY ii.Description
        ORDER BY fat DESC`, 50),
      // 6: funil de orçamentos (por data do orçamento)
      agentQuery(`
        SELECT eo.Status, COUNT(DISTINCT eo.Id) AS qtd, SUM(ei.TOTAL_SALE_PRICE) AS valor
        FROM veddara.EZ_VEDDARA_ESTIMATE_ORDER eo
        JOIN veddara.EZ_VEDDARA_ESTIMATE_ITEM ei ON eo.Id = ei.OrderId
        WHERE 1=1 ${fEstimate}
        GROUP BY eo.Status`, 50),
      // 7: clientes ativos (cadastral, não temporal)
      agentQuery(`
        SELECT COUNT(*) AS ativos FROM veddara.EZ_VEDDARA_CUSTOMER_CUSTOMER WHERE Status = 1`, 10),
      // 8: novos clientes por ano
      agentQuery(`
        SELECT YEAR(CreateDate) AS ano, COUNT(*) AS qtd
        FROM veddara.EZ_VEDDARA_CUSTOMER_CUSTOMER
        WHERE CreateDate IS NOT NULL AND YEAR(CreateDate) >= 2020 ${fCliente}
        GROUP BY YEAR(CreateDate)
        ORDER BY ano`, 50),
    ]

    // 9: faturamento do período anterior (PoP), só quando há filtro
    if (temFiltro && prevInicio && prevFim) {
      const prevFimMais1 = toISO(new Date(new Date(prevFim + 'T00:00:00').getTime() + 86400000))
      queries.push(agentQuery(`
        SELECT SUM(ii.TOTAL_SALE_PRICE) AS fat
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        WHERE io.${ST} ${ITEMF} AND io.DateInvoiceOrder >= '${prevInicio}' AND io.DateInvoiceOrder < '${prevFimMais1}'`, 10))
    }

    // Faturamento diário (só quando o período é de um único mês)
    let idxDiario = -1
    if (mesUnico) {
      idxDiario = queries.length
      queries.push(agentQuery(`
        SELECT YEAR(io.DateInvoiceOrder)*10000 + MONTH(io.DateInvoiceOrder)*100 + DAY(io.DateInvoiceOrder) AS dia,
               SUM(ii.TOTAL_SALE_PRICE) AS fat, COUNT(DISTINCT io.Id) AS notas
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        WHERE io.${ST} ${ITEMF} ${fInvoice}
        GROUP BY YEAR(io.DateInvoiceOrder)*10000 + MONTH(io.DateInvoiceOrder)*100 + DAY(io.DateInvoiceOrder)
        ORDER BY dia`, 100))
    }

    const res = await Promise.all(queries)
    const [qPeriodo, qAnual, qMensal, qClientes, qVendedores, qProdutos, qFunil, qAtivos, qNovos, qPrev] = res
    const qDiario = idxDiario >= 0 ? res[idxDiario] : null

    const faturamentoPeriodo = num(qPeriodo.rows[0]?.[0])
    const notasPeriodo = num(qPeriodo.rows[0]?.[1])
    const ticketMedio = notasPeriodo > 0 ? faturamentoPeriodo / notasPeriodo : 0

    // Crescimento PoP
    let faturamentoAnterior = 0
    let crescimentoPoP = 0
    if (temFiltro && qPrev) {
      faturamentoAnterior = num(qPrev.rows[0]?.[0])
      crescimentoPoP = faturamentoAnterior > 0
        ? ((faturamentoPeriodo - faturamentoAnterior) / faturamentoAnterior) * 100
        : 0
    } else {
      // Sem filtro: compara último ano vs penúltimo a partir do anual
      const anos = qAnual.rows.map(r => ({ ano: num(r[0]), fat: num(r[1]) })).sort((a, b) => b.ano - a.ano)
      const atual = anos[0]?.fat ?? 0
      const ant = anos[1]?.fat ?? 0
      faturamentoAnterior = ant
      crescimentoPoP = ant > 0 ? ((atual - ant) / ant) * 100 : 0
    }

    // Funil
    let convertidos = 0, perdidos = 0, abertos = 0, valorPipeline = 0
    for (const r of qFunil.rows) {
      const st = num(r[0]); const qtd = num(r[1]); const valor = num(r[2])
      if (st === 100) convertidos += qtd
      else if (st === 99) perdidos += qtd
      else if (st === 2 || st === 1) { abertos += qtd; valorPipeline += valor }
    }
    const winRate = (convertidos + perdidos) > 0
      ? (convertidos / (convertidos + perdidos)) * 100
      : 0

    const dados: DadosComercial = {
      periodo: { inicio, fim },
      kpis: {
        faturamentoPeriodo,
        faturamentoAnterior,
        crescimentoPoP,
        notasPeriodo,
        pipelineAberto: valorPipeline,
        pipelineQtd: abertos,
        clientesAtivos: num(qAtivos.rows[0]?.[0]),
        ticketMedio,
        winRate,
      },
      anual: qAnual.rows.map(r => ({ ano: str(r[0]), faturamento: num(r[1]), notas: num(r[2]) })),
      mensal: qMensal.rows.map(r => ({ anomes: str(r[0]), faturamento: num(r[1]), notas: num(r[2]) })),
      diario: qDiario ? qDiario.rows.map(r => ({ dia: str(r[0]), faturamento: num(r[1]), notas: num(r[2]) })) : [],
      granularidade: mesUnico ? 'diario' : 'mensal',
      topClientes: qClientes.rows.map(r => ({ nome: str(r[0]), faturamento: num(r[1]), notas: num(r[2]) })),
      topVendedores: qVendedores.rows.map(r => ({ nome: str(r[0]), faturamento: num(r[1]), notas: num(r[2]) })),
      topProdutos: qProdutos.rows.map(r => ({ nome: str(r[0]), faturamento: num(r[1]) })),
      funil: { convertidos, perdidos, abertos, valorPipeline },
      novosClientes: qNovos.rows.map(r => ({ ano: str(r[0]), qtd: num(r[1]) })),
    }

    return NextResponse.json(dados)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
