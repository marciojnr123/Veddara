import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { agentQuery } from '@/lib/agent'

// Diagnóstico temporário: mostra o que cada PaymentTermId (condição de pagamento)
// realmente representa nos dados, para conferir a análise de "Amostras & reposições".
// Abra /api/comercial/diag logado como admin e mande o JSON de volta.

const EMPRESA_ID = '929577C5-3B2C-459C-973E-C46211B8B251'
const HEX = (c: string) => `UPPER(REPLACE(CAST(${c} AS VARCHAR(64)),'-',''))`

const CONHECIDOS: Record<string, string> = {
  FA2D0BB736BC4E23BB62F3297B9AA051: 'PADRÃO (vendas normais)',
  '8865622628AF4763B400ACBBD7BE0E0F': 'AMOSTRAS E REPOSIÇÕES',
  '8D64213D82F64353A325CD3CD0F7988D': 'VENDA CONSIGNADA',
  '924BC710A3EC44F38973CB61CC31AD31': 'COMPRA CONSIGNADA',
  FF69DB6AF0974378803F9ACD8403C4C7: 'VENDA PROMOÇÃO VALIDADE',
  '2C70CBA5CC0A4DDCAAACD8F15E830D2F': 'JUDICIALIZAÇÃO',
}

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    // 1) Todas as condições de pagamento com volume (histórico), maiores primeiro
    const q1 = await agentQuery(`
      SELECT ${HEX('io.PaymentTermId')} AS termo,
             COUNT(DISTINCT io.Id) AS pedidos,
             SUM(ii.Quantity) AS qtd
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
      JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
      WHERE io.Status IN (1,100) AND io.SystemCustomerId = '${EMPRESA_ID}'
        AND ii.Status = 1 AND ii.ItemCode >= 1 AND io.PaymentTermId IS NOT NULL
      GROUP BY ${HEX('io.PaymentTermId')}
      ORDER BY pedidos DESC`, 100)

    const termos = q1.rows.map(r => {
      const hex = String(r[0] ?? '')
      return { termo: CONHECIDOS[hex] ?? '(desconhecido)', hex, pedidos: Number(r[1]) || 0, qtd: Number(r[2]) || 0 }
    })

    // 2) Amostra do que o filtro de AMOSTRAS retorna hoje (10 linhas)
    const q2 = await agentQuery(`
      SELECT TOP 15 c.Name AS cliente, ii.Description AS produto, io.DateInvoiceOrder AS data, ii.Quantity AS qtd
      FROM veddara.EZ_VEDDARA_INVOICE_ORDER io
      JOIN veddara.EZ_VEDDARA_INVOICE_ITEM ii ON io.Id = ii.OrderId
      JOIN veddara.EZ_VEDDARA_CUSTOMER_CUSTOMER c ON io.CustomerId = c.Id
      WHERE io.Status IN (1,100) AND io.SystemCustomerId = '${EMPRESA_ID}'
        AND ii.Status = 1 AND ii.ItemCode >= 1
        AND ${HEX('io.PaymentTermId')} = '8865622628AF4763B400ACBBD7BE0E0F'
      ORDER BY io.DateInvoiceOrder DESC`, 30)

    const amostraExemplo = q2.rows.map(r => ({
      cliente: String(r[0] ?? ''), produto: String(r[1] ?? ''), data: String(r[2] ?? ''), qtd: Number(r[3]) || 0,
    }))

    return NextResponse.json({ termos, amostraExemplo })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
