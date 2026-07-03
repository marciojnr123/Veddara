import { NextRequest, NextResponse } from 'next/server'
import { agentQuery } from '@/lib/agent'
import { requireAuth } from '@/lib/api-auth'

// Diagnóstico (admin) — descobre em qual schema cada tabela está e mostra as colunas.
// Abrir em /api/estoque/diag logado como admin. NÃO é usado pelo dashboard.

const SCHEMAS = ['', 'veddara.', 'IQHML.', 'dbo.', 'DBA.']

async function acharTabela(tabela: string) {
  for (const sch of SCHEMAS) {
    const ref = `${sch}${tabela}`
    try {
      const r = await agentQuery(`SELECT TOP 2 * FROM ${ref}`, 2)
      return { tabela, ok: true, encontrada_em: ref, colunas: r.columns, amostra: r.rows }
    } catch {
      // tenta o próximo schema
    }
  }
  return { tabela, ok: false, erro: 'não encontrada em: ' + SCHEMAS.map(s => s || '(sem schema)').join(', ') }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, ['admin'])
  if (auth instanceof NextResponse) return auth

  const probes = await Promise.all([
    acharTabela('EZ_VEDDARA_PRODUCT_PRODUCT'),
    acharTabela('TB_MILE_EXPRESS_CONTROLE_PEDIDO'),
    acharTabela('TB_MILE_EXPRESS_TRACKING'),
    acharTabela('EZ_VEDDARA_INVOICE_ITEM'),
  ])

  return NextResponse.json({ probes }, { headers: { 'Cache-Control': 'no-store' } })
}
