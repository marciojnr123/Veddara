/**
 * Regras de negócio que a IA deve seguir antes de executar qualquer consulta.
 * Adicione novas regras aqui — elas são injetadas automaticamente no system prompt.
 */

export const REGRAS_NEGOCIO = `
══════════════════════════════════════════
REGRAS DE NEGÓCIO — OBRIGATÓRIAS
══════════════════════════════════════════

## REGRA 0 — EMPRESA (FILTRO OBRIGATÓRIO EM TODA CONSULTA)

⚠️ A base contém dados de VÁRIAS empresas. SEMPRE filtre apenas a Veddara —
caso contrário a consulta traz vendedores, clientes e faturamento de OUTRAS
empresas (que não são da Veddara). Este filtro é OBRIGATÓRIO em TODA query:

  SystemCustomerId = '929577C5-3B2C-459C-973E-C46211B8B251'

A coluna SystemCustomerId existe nas tabelas de CABEÇALHO/CADASTRO:
  • EZ_VEDDARA_INVOICE_ORDER      (ex.: io.SystemCustomerId)
  • EZ_VEDDARA_SALE_ORDER         (so.SystemCustomerId)
  • EZ_VEDDARA_ESTIMATE_ORDER     (eo.SystemCustomerId)
  • EZ_VEDDARA_CUSTOMER_CUSTOMER  (c.SystemCustomerId)
  • EZ_VEDDARA_SALE_SALESPERSON   (sp.SystemCustomerId)
  • EZ_VEDDARA_CRM_RECORD

As tabelas de ITEM (INVOICE_ITEM, SALE_ITEM, ESTIMATE_ITEM) e CUSTOM_VALUE
NÃO têm SystemCustomerId — nesses casos, filtre pela tabela de cabeçalho com
a qual elas fazem JOIN (ex.: io.SystemCustomerId no JOIN com INVOICE_ITEM).

Exemplo:
  WHERE io.Status = 100
    AND io.SystemCustomerId = '929577C5-3B2C-459C-973E-C46211B8B251'

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

## REGRA 3.1 — CRM DO MÉDICO (Conselho Regional de Medicina)

⚠️ MÉDICO ≠ CLIENTE. NÃO confunda os dois:
  • CLIENTE = EZ_VEDDARA_CUSTOMER_CUSTOMER.Name → quem compra/paga (pode ser órgão
    público, empresa ou pessoa; ex: DTI, USP, bancos). NUNCA rotule o cliente como "médico".
  • MÉDICO = identificado pelo CRM em EZ_VEDDARA_CUSTOM_VALUE.Value → é um campo do
    pedido/orçamento, NÃO uma coluna do cliente.

O CRM fica em EZ_VEDDARA_CUSTOM_VALUE, na coluna **CRM** — USE SEMPRE a coluna CRM,
NUNCA a coluna Value. Filtre os médicos válidos com: cv.CRM IS NOT NULL AND cv.CRM <> 'SEMCRM'.
Ao montar uma query, use o alias correto: c.Name AS cliente e cv.CRM AS crm (ou crm_medico).
Nunca escreva "c.Name AS medico" nem use cv.Value para o CRM.

ATENÇÃO — desambiguação de "CRM":
  • "CRM" / "registro médico" / "conselho" → coluna Value de EZ_VEDDARA_CUSTOM_VALUE
  • "CRM" no sentido de relacionamento/interação/atendimento → EZ_VEDDARA_CRM_RECORD
  Se o usuário falar em CRM, número do conselho, registro do médico ou UF do médico,
  use EZ_VEDDARA_CUSTOM_VALUE.Value (NÃO a tabela CRM_RECORD, e NÃO a coluna CRM,
  que é truncada/malformada).

RELACIONAMENTO (o EntityId NÃO aponta para o cliente diretamente):
  • EZ_VEDDARA_CUSTOM_VALUE.EntityId = EZ_VEDDARA_SALE_ORDER.Id      (CRM no pedido)
  • EZ_VEDDARA_CUSTOM_VALUE.EntityId = EZ_VEDDARA_ESTIMATE_ORDER.Id  (CRM no orçamento)
  Para chegar ao cliente, passe pelo pedido ou orçamento:
    CUSTOM_VALUE.EntityId = SALE_ORDER.Id  →  SALE_ORDER.CustomerId = CUSTOMER_CUSTOMER.Id

  ⚠️ A PARTIR DE NOTA FISCAL: o EntityId NÃO casa com EZ_VEDDARA_INVOICE_ORDER.Id.
  Ligue a nota ao CRM pelo PEDIDO que a originou:
    CUSTOM_VALUE.EntityId = INVOICE_ORDER.SaleOrderId   (correto)
    CUSTOM_VALUE.EntityId = INVOICE_ORDER.Id            (ERRADO — retorna 0 linhas)

Exemplo (CRM do médico + cliente do pedido):
  SELECT DISTINCT c.Name AS cliente, cv.CRM AS crm_medico
  FROM veddara.EZ_VEDDARA_CUSTOM_VALUE cv
  JOIN veddara.EZ_VEDDARA_SALE_ORDER so ON cv.EntityId = so.Id
  JOIN veddara.EZ_VEDDARA_CUSTOMER_CUSTOMER c ON so.CustomerId = c.Id
  WHERE cv.CRM IS NOT NULL AND cv.CRM <> 'SEMCRM'

## REGRA 4 — COMISSÕES

Comissões ficam nos itens (SALE_ITEM, INVOICE_ITEM, ESTIMATE_ITEM):
  • CommissionSalesperson         → valor da comissão do vendedor no item
  • CommissionSalespersonPercentage → percentual de comissão
  • CommissionAgent               → comissão do agente
  • CommissionSupervisor          → comissão do supervisor

Para calcular comissão total de um vendedor, some CommissionSalesperson dos itens.
`
