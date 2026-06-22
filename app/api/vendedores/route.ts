import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'

export type CatVend = 'b2b' | 'b2c' | 'sem'
export interface DadosVendedores {
  periodo: { inicio: string | null; fim: string | null }
  vendedores: Array<{ nome: string; cat: CatVend; fat: number; notas: number; clientes: number; comissao: number; ganhos: number; perdidos: number }>
  rankAno: Array<{ nome: string; fat: number }>
  rankMes: Array<{ nome: string; fat: number }>
  mensalCanal: Array<{ anomes: string; b2b: number; b2c: number; sem: number }>
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => String(v ?? '').trim()

// filtros validados (iguais à Comercial)
const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'
const ST = 'Status IN (1, 100)'
const ITEMF = 'AND ii.Status = 1 AND ii.ItemCode >= 1'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function validData(s: string | null): string | null {
  if (!s || !DATE_RE.test(s)) return null
  const d = new Date(s + 'T00:00:00'); return Number.isNaN(d.getTime()) ? null : s
}
function toISO(d: Date): string { return d.toISOString().slice(0, 10) }

// ── Categorização B2B / B2C / Sem representante (por nome do vendedor) ──
function norm(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}
const B2C = ['FABIO PINHEIRO', 'LYGIA RODRIGUES', 'DENIS COMISSO', 'INGRID FRAGOSO'].map(norm)
const SEM = ['CARINA CAVALHEIRO', 'BIANCA MARIA PEREIRA DA COSTA', 'VENDAS DA VEDDARA'].map(norm)
function categoria(nome: string): CatVend {
  const n = norm(nome)
  if (B2C.some(x => n === x || n.startsWith(x))) return 'b2c'
  if (SEM.some(x => n === x || n.startsWith(x) || x.startsWith(n))) return 'sem'
  return 'b2b'
}

export async function GET(req: NextRequest) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const inicio = validData(searchParams.get('inicio'))
  const fim = validData(searchParams.get('fim'))
  const temFiltro = !!(inicio && fim)
  const fimMais1 = fim ? toISO(new Date(new Date(fim + 'T00:00:00').getTime() + 86400000)) : null
  const fInvoice = temFiltro ? `AND io.DateInvoiceOrder >= '${inicio}' AND io.DateInvoiceOrder < '${fimMais1}'` : ''

  const anoAtual = new Date().getFullYear()
  const inicioAno = `${anoAtual}-01-01`
  const mesAtual = `${anoAtual}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  // mensal: dentro do filtro, ou últimos ~24 meses por padrão
  const fMensal = temFiltro ? fInvoice : `AND io.DateInvoiceOrder >= '2024-07-01'`

  const SEL_VEND = `sp.Firstname || ' ' || ISNULL(sp.LastName, '')`
  function qFatPorVend(filtroData: string) {
    return `
      SELECT ${SEL_VEND} AS nome,
             SUM(ii.TOTAL_SALE_PRICE) AS fat,
             COUNT(DISTINCT io.Id) AS notas,
             COUNT(DISTINCT io.CustomerId) AS clientes
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
      JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
      JOIN veddara.EZ_VEDDARA_SALE_SALESPERSON sp ON io.SalespersonId = sp.Id
      WHERE io.${ST} ${ITEMF} AND io.SystemCustomerId = '${EMPRESA_ID}' ${filtroData}
      GROUP BY sp.Firstname, sp.LastName
      ORDER BY fat DESC`
  }

  try {
    const [qVend, qAno, qMes, qOrc, qMensal] = await Promise.all([
      agentQuery(qFatPorVend(fInvoice), 200),
      agentQuery(qFatPorVend(`AND io.DateInvoiceOrder >= '${inicioAno}'`), 200),
      agentQuery(qFatPorVend(`AND io.DateInvoiceOrder >= '${mesAtual}'`), 200),
      // orçamentos por vendedor (ganhos = 100, perdidos = 99)
      agentQuery(`
        SELECT sp.Firstname || ' ' || ISNULL(sp.LastName, '') AS nome, eo.Status, COUNT(DISTINCT eo.Id) AS qtd
        FROM veddara.EZ_VEDDARA_ESTIMATE_ORDER eo
        JOIN veddara.EZ_VEDDARA_SALE_SALESPERSON sp ON eo.SalespersonId = sp.Id
        WHERE eo.SystemCustomerId = '${EMPRESA_ID}' AND eo.Status IN (99, 100)
        GROUP BY sp.Firstname, sp.LastName, eo.Status`, 500),
      // faturamento por vendedor x mês (para o gráfico B2B x B2C x Sem representante)
      agentQuery(`
        SELECT ${SEL_VEND} AS nome,
               YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder) AS anomes,
               SUM(ii.TOTAL_SALE_PRICE) AS fat
        FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
        JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
        JOIN veddara.EZ_VEDDARA_SALE_SALESPERSON sp ON io.SalespersonId = sp.Id
        WHERE io.${ST} ${ITEMF} AND io.SystemCustomerId = '${EMPRESA_ID}' ${fMensal}
        GROUP BY sp.Firstname, sp.LastName, YEAR(io.DateInvoiceOrder)*100 + MONTH(io.DateInvoiceOrder)`, 3000),
    ])

    // orçamentos por vendedor
    const orc: Record<string, { ganhos: number; perdidos: number }> = {}
    for (const r of qOrc.rows) {
      const nome = str(r[0]); const st = num(r[1]); const qtd = num(r[2])
      if (!orc[nome]) orc[nome] = { ganhos: 0, perdidos: 0 }
      if (st === 100) orc[nome].ganhos += qtd
      else if (st === 99) orc[nome].perdidos += qtd
    }

    const vendedores = qVend.rows.map(r => {
      const nome = str(r[0])
      return {
        nome, cat: categoria(nome),
        fat: num(r[1]), notas: num(r[2]), clientes: num(r[3]), comissao: 0,
        ganhos: orc[nome]?.ganhos ?? 0, perdidos: orc[nome]?.perdidos ?? 0,
      }
    })
    const rankAno = qAno.rows.map(r => ({ nome: str(r[0]), fat: num(r[1]) }))
    const rankMes = qMes.rows.map(r => ({ nome: str(r[0]), fat: num(r[1]) }))

    // mensal por canal
    const mensalMap: Record<string, { b2b: number; b2c: number; sem: number }> = {}
    for (const r of qMensal.rows) {
      const cat = categoria(str(r[0]))
      const anomes = str(r[1]); const fat = num(r[2])
      if (!anomes) continue
      if (!mensalMap[anomes]) mensalMap[anomes] = { b2b: 0, b2c: 0, sem: 0 }
      mensalMap[anomes][cat] += fat
    }
    const mensalCanal = Object.entries(mensalMap)
      .map(([anomes, v]) => ({ anomes, ...v }))
      .sort((a, b) => a.anomes.localeCompare(b.anomes))

    const dados: DadosVendedores = { periodo: { inicio, fim }, vendedores, rankAno, rankMes, mensalCanal }
    return NextResponse.json(dados)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
