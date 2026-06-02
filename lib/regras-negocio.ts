/**
 * Regras de negócio que a IA deve seguir antes de executar qualquer consulta.
 * Adicione novas regras aqui — elas são injetadas automaticamente no system prompt.
 */

export const REGRAS_NEGOCIO = `
══════════════════════════════════════════
REGRAS DE NEGÓCIO — OBRIGATÓRIAS
══════════════════════════════════════════

## REGRA 1 — FATURAMENTO: usar EZ_VEDDARA_INVOICE_ORDER + INVOICE_ITEM

Toda vez que o usuário perguntar sobre faturamento, receita ou valor faturado,
use SEMPRE a tabela EZ_VEDDARA_INVOICE_ORDER (cabeçalho) com JOIN em
EZ_VEDDARA_INVOICE_ITEM (itens) e filtre Status = 100 (notas efetivadas, não canceladas).

  • Valor faturado total → SUM(ii.TOTAL_SALE_PRICE) nos itens
  • NUNCA some valores do cabeçalho diretamente — o detalhe fica nos itens
  • Sempre filtre: WHERE io.Status = 100  (exclui notas canceladas/rascunho)

## REGRA 2 — STATUS DAS ENTIDADES (valores reais do banco)

ATENÇÃO: existem DOIS esquemas de Status diferentes neste banco.

### Documentos / Ordens (Estimate, Sale, Invoice) — usar Status = 100
  • 100 = Efetivado / Finalizado (válido — orçamento convertido, pedido faturado, NF emitida)
  • 99  = Cancelado / Perdido
  • 2   = Em aberto / Em andamento
  • 1   = Rascunho / Aberto inicial
  Aplica-se a: EZ_VEDDARA_INVOICE_ORDER, EZ_VEDDARA_SALE_ORDER, EZ_VEDDARA_ESTIMATE_ORDER

### Cadastros (Customer, Salesperson) — usar Status = 1
  • 1 = Ativo
  • 2 = Inativo
  • 0 = Sem classificação / incompleto
  Aplica-se a: EZ_VEDDARA_CUSTOMER_CUSTOMER, EZ_VEDDARA_SALE_SALESPERSON

SEMPRE aplique filtro de Status nas consultas de análise:
  • Faturamento / notas emitidas:  WHERE io.Status = 100
  • Pedidos faturados:             WHERE so.Status = 100
  • Orçamentos ganhos/convertidos: WHERE eo.Status = 100
  • Orçamentos em aberto (pipeline): WHERE eo.Status IN (1, 2)
  • Orçamentos perdidos:           WHERE eo.Status = 99
  • Clientes ativos:               WHERE Status = 1
  • Vendedores ativos:             WHERE Status = 1

NUNCA use Status = 1 para filtrar notas/pedidos/orçamentos válidos — nas ordens, o valor
válido é 100. Status = 1 nas ordens significa rascunho.

## REGRA 2.1 — TAXA DE CONVERSÃO (win rate) de orçamentos

Win rate = orçamentos ganhos ÷ (ganhos + perdidos), ignorando os ainda em aberto:
  • Ganhos   → eo.Status = 100  (têm SalesOrderId preenchido)
  • Perdidos → eo.Status = 99
  • Em aberto (não entram no cálculo) → eo.Status IN (1, 2)

## REGRA 3 — JOINS PRINCIPAIS

Os relacionamentos mais usados:
  • Cliente ↔ Pedido de Venda:    EZ_VEDDARA_SALE_ORDER.CustomerId = EZ_VEDDARA_CUSTOMER_CUSTOMER.Id
  • Cliente ↔ Nota Fiscal:        EZ_VEDDARA_INVOICE_ORDER.CustomerId = EZ_VEDDARA_CUSTOMER_CUSTOMER.Id
  • Vendedor ↔ Pedido de Venda:   EZ_VEDDARA_SALE_ORDER.SalespersonId = EZ_VEDDARA_SALE_SALESPERSON.Id
  • Cabeçalho ↔ Itens Venda:      EZ_VEDDARA_SALE_ITEM.OrderId = EZ_VEDDARA_SALE_ORDER.Id
  • Cabeçalho ↔ Itens NF:         EZ_VEDDARA_INVOICE_ITEM.OrderId = EZ_VEDDARA_INVOICE_ORDER.Id
  • Cabeçalho ↔ Itens Orçamento:  EZ_VEDDARA_ESTIMATE_ITEM.OrderId = EZ_VEDDARA_ESTIMATE_ORDER.Id
  • Orçamento → Pedido de Venda:  EZ_VEDDARA_ESTIMATE_ORDER.SalesOrderId = EZ_VEDDARA_SALE_ORDER.Id
  • Pedido → Nota Fiscal:         EZ_VEDDARA_SALE_ORDER.InvoiceId = EZ_VEDDARA_INVOICE_ORDER.Id

## REGRA 4 — COMISSÕES

Comissões ficam nos itens (SALE_ITEM, INVOICE_ITEM, ESTIMATE_ITEM):
  • CommissionSalesperson         → valor da comissão do vendedor no item
  • CommissionSalespersonPercentage → percentual de comissão
  • CommissionAgent               → comissão do agente
  • CommissionSupervisor          → comissão do supervisor

Para calcular comissão total de um vendedor, some CommissionSalesperson dos itens.
`
