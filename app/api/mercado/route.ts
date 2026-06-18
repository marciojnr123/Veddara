import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'

export interface DadosMercado {
  periodo: { inicio: string | null; fim: string | null }
  vendasPorEstado: Array<{ uf: string; faturamento: number; notas: number }>
  semUf: { faturamento: number; notas: number }
}

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
    // Faturamento por estado (mesmo join/filtro da Comercial, agrupando pela UF do cliente)
    const q = await agentQuery(`
      SELECT c.MainAddressState AS uf,
             SUM(ii.TOTAL_SALE_PRICE) AS faturamento,
             COUNT(DISTINCT io.Id)    AS notas
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
      JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
      JOIN veddara.EZ_VEDDARA_CUSTOMER_CUSTOMER c ON io.CustomerId = c.Id
      WHERE io.Status = 100 ${fData}
      GROUP BY c.MainAddressState
      ORDER BY faturamento DESC`, 200)

    // Consolida siglas + nomes completos no mesmo estado
    const acc: Record<string, { faturamento: number; notas: number }> = {}
    const semUf = { faturamento: 0, notas: 0 }
    for (const r of q.rows) {
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

    const dados: DadosMercado = { periodo: { inicio, fim }, vendasPorEstado, semUf }
    return NextResponse.json(dados)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
