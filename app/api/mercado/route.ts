import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'

export interface DadosMercado {
  periodo: { inicio: string | null; fim: string | null }
  vendasPorEstado: Array<{ uf: string; faturamento: number; notas: number }>
  semUf: { faturamento: number; notas: number }
  consignado: {
    mensal: Array<{ anomes: string; consignada: number; importada: number }>
    totalConsignada: number
    totalImportada: number
    pctConsignada: number
    erro: string | null
  }
  recompraMensal: Array<{ anomes: string; recompra: number }>
}

// Condição de pagamento que representa a VENDA CONSIGNADA (médico vende o produto).
// Todo o resto é tratado como "importada" — assim consignada + importada = faturamento
// total (Status=100), batendo com a aba Comercial.
const CONDICOES_CONSIGNADO = new Set(['VENDA CONSIGNADA'])

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Valida formato YYYY-MM-DD (evita injeção de SQL) — mesmo padrão da API Comercial
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function validData(s: string | null): string | null {
  if (!s || !DATE_RE.test(s)) return null
  const d = new Date(s + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : s
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ── Normalização da UF ──────────────────────────────────────────────
// 99% dos registros vêm como sigla ("SP"), mas há casos gravados como
// nome completo ("São Paulo"). Esta função converte ambos para a sigla,
// de modo que "SP" e "São Paulo" sejam somados no mesmo estado.
const SIGLAS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])
const NOME_PARA_UF: Record<string, string> = {
  'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPA': 'AP', 'AMAZONAS': 'AM', 'BAHIA': 'BA',
  'CEARA': 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPIRITO SANTO': 'ES', 'GOIAS': 'GO',
  'MARANHAO': 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG', 'PARA': 'PA', 'PARAIBA': 'PB', 'PARANA': 'PR',
  'PERNAMBUCO': 'PE', 'PIAUI': 'PI', 'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS', 'RONDONIA': 'RO',
  'RORAIMA': 'RR', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP', 'SERGIPE': 'SE',
  'TOCANTINS': 'TO',
}
function normalizeUF(raw: unknown): string | null {
  // tira espaços, sobe pra maiúsculo e remove acentos
  const s = String(raw ?? '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!s) return null
  if (s.length === 2 && SIGLAS.has(s)) return s
  if (NOME_PARA_UF[s]) return NOME_PARA_UF[s]
  return null // vazio / exterior / desconhecido
}

export async function GET(req: NextRequest) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const inicio = validData(searchParams.get('inicio'))
  const fim = validData(searchParams.get('fim'))
  const temFiltro = !!(inicio && fim)

  // fim inclusivo (+1 dia), igual à API Comercial
  const fimMais1 = fim ? toISO(new Date(new Date(fim + 'T00:00:00').getTime() + 86400000)) : null
  const fData = temFiltro
    ? `AND io.DateInvoiceOrder >= '${inicio}' AND io.DateInvoiceOrder < '${fimMais1}'`
    : ''

  try {
    const [qEstado, qRecompra] = await Promise.all([
      // 1) Faturamento por estado (UF do cliente) — consulta principal do mapa
      agentQuery(`
        SELECT c.MainAddressState AS uf,
               SUM(ii.TOTAL_SALE_PRICE) AS faturamento,
               COUNT(DISTINCT io.Id)    AS notas
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        JOIN veddara.EZ_VEDDARA_CUSTOMER_CUSTOMER c ON io.CustomerId = c.Id
        WHERE io.Status = 100 ${fData}
        GROUP BY c.MainAddressState
        ORDER BY faturamento DESC`, 200),
      // 2) Recompra mensal: clientes que compraram no mês e cuja 1ª compra
      //    (todo o histórico) foi ANTES daquele mês. m = compras no período;
      //    f = mês da 1ª compra de cada cliente (sem filtro de data).
      agentQuery(`
        SELECT m.anomes, COUNT(DISTINCT m.CustomerId) AS recompra
        FROM (
          SELECT DISTINCT io.CustomerId AS CustomerId,
                 YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder) AS anomes
          FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
          WHERE io.Status = 100 ${fData}
        ) m
        JOIN (
          SELECT io2.CustomerId AS CustomerId,
                 MIN(YEAR(io2.DateInvoiceOrder)*100 + MONTH(io2.DateInvoiceOrder)) AS first_anomes
          FROM veddara.EZ_VEDDARA_INVOICE_ORDER io2
          WHERE io2.Status = 100
          GROUP BY io2.CustomerId
        ) f ON f.CustomerId = m.CustomerId
        WHERE m.anomes > f.first_anomes
        GROUP BY m.anomes
        ORDER BY m.anomes`, 500),
    ])

    // ── Vendas por estado (consolida siglas + nomes completos na mesma UF) ──
    const acc: Record<string, { faturamento: number; notas: number }> = {}
    const semUf = { faturamento: 0, notas: 0 }
    for (const r of qEstado.rows) {
      const uf = normalizeUF(r[0])
      const fat = num(r[1]); const notas = num(r[2])
      if (!uf) { semUf.faturamento += fat; semUf.notas += notas; continue }
      if (!acc[uf]) acc[uf] = { faturamento: 0, notas: 0 }
      acc[uf].faturamento += fat
      acc[uf].notas += notas
    }
    const vendasPorEstado = Object.entries(acc)
      .map(([uf, v]) => ({ uf, faturamento: v.faturamento, notas: v.notas }))
      .sort((a, b) => b.faturamento - a.faturamento)

    // 2) Consignada vs importada (por mês) — NÃO-FATAL: se a tabela de condição
    //    de pagamento não resolver, o mapa continua funcionando normalmente.
    const consignado = { mensal: [] as Array<{ anomes: string; consignada: number; importada: number }>, totalConsignada: 0, totalImportada: 0, pctConsignada: 0, erro: null as string | null }
    try {
      const qConsig = await agentQuery(`
        SELECT pt.Description AS cond,
               YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder) AS anomes,
               SUM(ii.TOTAL_SALE_PRICE) AS fat
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        LEFT JOIN veddara.EZ_VEDDARA_FINANCIAL_PAYMENTTERM pt ON pt.Id = io.PaymentTermId
        WHERE io.Status = 100 ${fData}
        GROUP BY pt.Description, YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder)
        ORDER BY anomes`, 2000)

      const mensalMap: Record<string, { consignada: number; importada: number }> = {}
      let totalConsignada = 0, totalImportada = 0
      for (const r of qConsig.rows) {
        const cond = String(r[0] ?? '').trim().toUpperCase()
        const anomes = String(r[1] ?? '')
        const fat = num(r[2])
        if (!anomes) continue
        if (!mensalMap[anomes]) mensalMap[anomes] = { consignada: 0, importada: 0 }
        if (CONDICOES_CONSIGNADO.has(cond)) { mensalMap[anomes].consignada += fat; totalConsignada += fat }
        else { mensalMap[anomes].importada += fat; totalImportada += fat }
      }
      consignado.mensal = Object.entries(mensalMap)
        .map(([anomes, v]) => ({ anomes, consignada: v.consignada, importada: v.importada }))
        .sort((a, b) => a.anomes.localeCompare(b.anomes))
      consignado.totalConsignada = totalConsignada
      consignado.totalImportada = totalImportada
      const totalGeral = totalConsignada + totalImportada
      consignado.pctConsignada = totalGeral > 0 ? (totalConsignada / totalGeral) * 100 : 0
    } catch (e) {
      consignado.erro = String(e)
    }

    // ── Recompra mensal ──
    const recompraMensal = qRecompra.rows
      .map(r => ({ anomes: String(r[0] ?? ''), recompra: num(r[1]) }))
      .filter(x => x.anomes)
      .sort((a, b) => a.anomes.localeCompare(b.anomes))

    const dados: DadosMercado = { periodo: { inicio, fim }, vendasPorEstado, semUf, consignado, recompraMensal }
    return NextResponse.json(dados)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
