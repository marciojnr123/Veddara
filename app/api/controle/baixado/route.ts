// app/api/controle/baixado/route.ts
// Estado "Baixado" do Controle Rastreio, COMPARTILHADO entre todos os usuários
// (guardado no Postgres do app). Presença da chave = baixado; ausência = não baixado.
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

let tabelaOk = false
async function garantirTabela() {
  if (tabelaOk) return
  await query(`CREATE TABLE IF NOT EXISTS controle_baixado (
    chave TEXT PRIMARY KEY,
    baixado_por VARCHAR(180),
    baixado_em TIMESTAMP DEFAULT NOW()
  )`)
  tabelaOk = true
}

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    await garantirTabela()
    const r = await query<{ chave: string }>('SELECT chave FROM controle_baixado')
    return NextResponse.json({ chaves: r.rows.map(x => x.chave) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    await garantirTabela()
    const body = await req.json()
    const chaves: string[] = Array.isArray(body?.chaves)
      ? body.chaves.filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)
      : []
    const baixado = body?.baixado === true
    if (!chaves.length) return NextResponse.json({ ok: true, alterados: 0 })

    if (baixado) {
      // Upsert em lote: marca (ou re-marca com quem baixou por último)
      const values = chaves.map((_, idx) => `($${idx + 1}, $${chaves.length + 1})`).join(',')
      await query(
        `INSERT INTO controle_baixado (chave, baixado_por) VALUES ${values}
         ON CONFLICT (chave) DO UPDATE SET baixado_por = EXCLUDED.baixado_por, baixado_em = NOW()`,
        [...chaves, session.email],
      )
    } else {
      await query('DELETE FROM controle_baixado WHERE chave = ANY($1)', [chaves])
    }
    return NextResponse.json({ ok: true, alterados: chaves.length })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
