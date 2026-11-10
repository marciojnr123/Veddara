'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppSidebar, VeddaraLogo } from '@/components/AppSidebar'
import type { EstoqueItem } from '@/app/api/estoque/route'
import type { PendenciaItem } from '@/app/api/estoque/pendencias/route'

function fmtNum(v: number): string { return v.toLocaleString('pt-BR') }

// dd/mm/aaaa a partir de YYYY-MM-DD (direto no texto, sem conversão de fuso)
function fmtDataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—')
}

// Gera um CSV com BOM (acentos certos no Excel) e baixa no navegador.
function baixarCsv(nomeArquivo: string, headers: string[], rows: unknown[][]) {
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
const hoje = () => new Date().toISOString().slice(0, 10)

// Baixa a tabela (respeitando os filtros aplicados) como CSV — abre direto no Excel.
function baixarEstoque(linhas: EstoqueItem[]) {
  const headers = ['Código', 'Produto', 'SKU', 'Est. Inicial', 'Est. Mile', 'Est. TriStar', 'Vendas s/ Integr.', 'Mile s/ Integr.', 'TriStar Rascunho', 'Compras', 'Remessa Parcial Não Enviada', 'Estoque', 'Status']
  const rows = linhas.map(i => [i.productId, i.produto, i.sku, i.inicial, i.atual, i.estTristar, i.vendasSemInt, i.mileSemInt, i.tristarSemInt, i.compras, i.remessasNaoInt, i.estoqueLogico, i.status])
  baixarCsv(`estoque-${hoje()}.csv`, headers, rows)
}

// Grupos do pop-up de pendências, na ordem em que aparecem
const TIPOS_PEND: Array<{ tipo: PendenciaItem['tipo']; titulo: string }> = [
  { tipo: 'venda_sem_int', titulo: 'Vendas sem integração' },
  { tipo: 'mile_sem_int', titulo: 'Mile sem integração' },
  { tipo: 'tristar_rascunho', titulo: 'TriStar rascunho' },
]
const TITULO_MANUAL = 'Vendas desde 28/07 (controle manual)'

// Baixa só as pendências de um produto (as mesmas linhas do pop-up).
function baixarPendencias(produto: EstoqueItem, linhas: PendenciaItem[], manual: boolean) {
  const nomeTipo = (t: PendenciaItem['tipo']) =>
    manual && t === 'venda_sem_int' ? TITULO_MANUAL : (TIPOS_PEND.find(x => x.tipo === t)?.titulo ?? t)
  const headers = ['Tipo', 'Invoice', 'Data', 'Dias parado', 'Cliente', 'Vendedor', 'Qtd', 'Transportadora', 'Rastreio', 'Situação', 'Plano']
  const ordem = (t: PendenciaItem['tipo']) => TIPOS_PEND.findIndex(x => x.tipo === t)
  const rows = [...linhas]
    .sort((a, b) => ordem(a.tipo) - ordem(b.tipo) || b.diasParado - a.diasParado)
    .map(p => [nomeTipo(p.tipo), p.invoice, fmtDataBR(p.data), p.diasParado, p.cliente, p.vendedor, p.qtd, p.transportadora ?? '', p.rastreio ?? '', p.situacao, p.plano ?? ''])
  baixarCsv(`pendencias-${produto.productId}-${hoje()}.csv`, headers, rows)
}

const plural = (n: number, um: string, varios: string) => `${fmtNum(n)} ${n === 1 ? um : varios}`

// Pop-up com os pedidos parados de um produto, separados por tipo de pendência.
function PendenciasModal({ produto, linhas, erro, onClose }: {
  produto: EstoqueItem
  linhas: PendenciaItem[]
  erro: string | null
  onClose: () => void
}) {
  const fecharRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    fecharRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const overflowAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden'   // não deixa a página de trás rolar
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflowAntes }
  }, [onClose])

  const manual = linhas.some(l => l.controleManual)
  const grupos = TIPOS_PEND.map(t => {
    const ls = linhas.filter(l => l.tipo === t.tipo).sort((a, b) => b.diasParado - a.diasParado)
    return {
      tipo: t.tipo,
      titulo: manual && t.tipo === 'venda_sem_int' ? TITULO_MANUAL : t.titulo,
      linhas: ls,
      un: ls.reduce((s, l) => s + l.qtd, 0),
      pedidos: new Set(ls.map(l => l.invoice)).size,
    }
  })
  // Nos de controle manual todas as linhas são do 1º grupo; os outros contadores seriam sempre zero
  const resumo = manual ? grupos.filter(g => g.tipo === 'venda_sem_int') : grupos
  const comLinhas = grupos.filter(g => g.linhas.length)
  const totalUn = grupos.reduce((s, g) => s + g.un, 0)

  return (
    <div className="kest-ov" onClick={onClose}>
      <div className="kest-modal" role="dialog" aria-modal="true" aria-labelledby="kest-mtitle" onClick={e => e.stopPropagation()}>
        <div className="kest-mhead">
          <div style={{ minWidth: 0 }}>
            <div className="kest-mcod">Cód. {produto.productId} · pedidos parados</div>
            <h2 id="kest-mtitle" className="kest-mtitle">{produto.produto || '—'}</h2>
          </div>
          <button ref={fecharRef} type="button" className="kest-x" onClick={onClose} aria-label="Fechar" title="Fechar (Esc)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="kest-mbody">
          {erro ? (
            <div className="kest-merr">Não foi possível carregar os pedidos parados: {erro}</div>
          ) : (
            <>
              <div className="kest-msum">
                {resumo.map(g => (
                  <span key={g.tipo} className={g.un ? 'on' : ''}>
                    <b>{g.titulo}:</b> {plural(g.un, 'un', 'un')} em {plural(g.pedidos, 'pedido', 'pedidos')}
                  </span>
                ))}
              </div>
              {manual && (
                <div className="kest-maviso">Produto de controle manual: todas as vendas desde 28/07 descontam do saldo, mesmo as já integradas.</div>
              )}
              {comLinhas.length === 0 && <div className="kest-empty">Nenhum pedido parado neste produto.</div>}
              {comLinhas.map(g => (
                <section key={g.tipo} className="kest-msec">
                  <h3>{g.titulo} <span>{plural(g.un, 'un', 'un')} · {plural(g.pedidos, 'pedido', 'pedidos')}</span></h3>
                  <div className="kest-mtablewrap">
                    <table className="kest-mtable">
                      <colgroup>
                        {['7%', '9%', '8%', '20%', '9%', '5%', '15%', '18%', '9%'].map((w, k) => <col key={k} style={{ width: w }} />)}
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Invoice</th><th>Data</th><th className="r">Dias parado</th><th>Cliente</th><th>Vendedor</th>
                          <th className="r">Qtd</th><th>Rastreio</th><th>Situação</th><th>Plano</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.linhas.map((p, ix) => (
                          <tr key={`${p.invoice}-${ix}`} className={p.diasParado > 30 ? 'velho' : ''}>
                            <td className="num">{p.invoice || '—'}</td>
                            <td className="num">{fmtDataBR(p.data)}</td>
                            <td className="r dias">{fmtNum(p.diasParado)}</td>
                            <td className="cli">{p.cliente || '—'}</td>
                            <td>{p.vendedor || '—'}</td>
                            <td className="r qtd">{fmtNum(p.qtd)}</td>
                            <td className="num">{p.rastreio || '—'}</td>
                            <td className="sit">{p.situacao || '—'}</td>
                            <td>{p.plano || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        <div className="kest-mfoot">
          <span>{erro ? '' : <>Total parado: <b>{plural(totalUn, 'unidade', 'unidades')}</b>{totalUn ? ' · linhas laranja = mais de 30 dias parado' : ''}</>}</span>
          <button
            type="button"
            className="kest-mdl"
            onClick={() => baixarPendencias(produto, linhas, manual)}
            disabled={!!erro || !linhas.length}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Baixar Excel
          </button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.kest-root, .kest-root * { box-sizing: border-box; }
.kest-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  display: grid; grid-template-columns: 150px 1fr; min-height: 100vh;
  background: linear-gradient(135deg, #eaf1fc 0%, #f2f6fc 45%, #fdeee7 100%); background-attachment: fixed;
  color: #1e293b;
  --blue: #2563EB; --cyan: #22C3DD; --danger: #e11d48; --warn: #ea580c; --ok: #16a34a;
  --line: #e8edf3; --ink-3: #94a3b8;
}
.kest-main { padding: 20px 26px 44px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }

.kest-top { display: flex; align-items: center; justify-content: center; position: relative; min-height: 46px; }
.kest-brand { position: absolute; left: 0; top: 50%; transform: translateY(-50%); }
.kest-title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 34px; letter-spacing: -0.01em; margin: 0; text-align: center; }
.kest-title em { font-style: normal; background: linear-gradient(90deg, var(--blue), var(--cyan)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.kest-right { position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 12px; }
.kest-refresh { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: #fff; color: #64748b; display: grid; place-items: center; cursor: pointer; }
.kest-refresh:hover { background: #f8fafc; color: #1e293b; }
.kest-refresh:active { transform: scale(.93); }

.kest-prev { align-self: center; font-size: 11.5px; font-weight: 700; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 999px; padding: 4px 12px; }

.kest-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kest-kpi { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 16px 18px; box-shadow: 0 6px 22px rgba(15,23,42,.05); }
.kest-kpi-lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
.kest-kpi-val { font-size: 27px; font-weight: 800; margin-top: 4px; letter-spacing: -.02em; }
.kest-kpi.warn { background: #fff7ed; border-color: #fed7aa; }
.kest-kpi.warn .kest-kpi-lbl, .kest-kpi.warn .kest-kpi-val { color: var(--warn); }

.kest-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.kest-search { flex: 1; min-width: 200px; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 9px 14px; font-size: 13.5px; font-family: inherit; color: #1e293b; outline: none; }
.kest-search:focus { border-color: var(--blue); }
.kest-select { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 13.5px; font-weight: 600; font-family: inherit; color: #1e293b; outline: none; cursor: pointer; }
.kest-select:focus { border-color: var(--blue); }
.kest-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; cursor: pointer; user-select: none; }
.kest-toggle input { display: none; }
.kest-toggle .tk { width: 34px; height: 19px; border-radius: 999px; background: #cbd5e1; position: relative; transition: background .15s; }
.kest-toggle .tk::after { content: ''; position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: #fff; transition: transform .15s; }
.kest-toggle input:checked + .tk { background: var(--warn); }
.kest-toggle input:checked + .tk::after { transform: translateX(15px); }

.kest-tablewrap { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: auto; box-shadow: 0 6px 22px rgba(15,23,42,.05); }
.kest-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 760px; }
.kest-table thead th { background: #f8fafc; color: #64748b; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 11px 12px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
.kest-table thead th.l { text-align: left; }
/* títulos longos das colunas de números quebram em 2 linhas, pra tabela caber na tela */
.kest-table thead th:not(.l) { white-space: normal; vertical-align: bottom; line-height: 1.3; }
.kest-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #475569; font-variant-numeric: tabular-nums; }
.kest-table tr:last-child td { border-bottom: 0; }
.kest-table td.prod { text-align: left; color: #1e293b; font-weight: 600; max-width: 380px; }
.kest-table td.sku { text-align: left; color: var(--ink-3); }
.kest-table td.atual { font-weight: 800; color: #1e293b; }
.kest-table td.atual.low { color: var(--warn); }
.kest-table td.atual.neg { color: var(--danger); }
.kest-table tbody tr:hover td { background: #f8fbff; }
.kest-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; background: #fff7ed; color: var(--warn); }
.kest-st { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
.kest-st.ok { background: #ecfdf5; color: var(--ok); }
.kest-st.nok { background: #fff7ed; color: var(--warn); }
.kest-empty { padding: 40px; text-align: center; color: var(--ink-3); font-size: 13.5px; }
.kest-sk { height: 300px; border-radius: 16px; background: linear-gradient(90deg,#f1f5f9,#f8fafc,#f1f5f9); background-size: 200% 100%; animation: kestpulse 1.3s ease-in-out infinite; }
@keyframes kestpulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* Código do produto clicável (só quando há pedidos parados) */
.kest-codlink { background: none; border: 0; padding: 0; font: inherit; font-weight: 800; color: var(--warn); cursor: pointer; text-underline-offset: 3px; }
.kest-codlink:hover { text-decoration: underline; }
.kest-codlink:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 4px; }

/* Pop-up de pendências */
.kest-ov { position: fixed; inset: 0; z-index: 500; background: rgba(15,23,42,.45); display: grid; place-items: center; padding: 24px; }
.kest-modal { width: 100%; max-width: 1120px; max-height: 88vh; display: flex; flex-direction: column; background: #fff; border-radius: 18px; box-shadow: 0 24px 70px rgba(15,23,42,.3); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #1e293b; }
.kest-mhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 14px; border-bottom: 1px solid var(--line); }
.kest-mcod { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--warn); }
.kest-mtitle { font-size: 18px; font-weight: 800; margin: 3px 0 0; letter-spacing: -.01em; }
.kest-x { flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line); background: #fff; color: #64748b; display: grid; place-items: center; cursor: pointer; }
.kest-x:hover { background: #f8fafc; color: #1e293b; }
.kest-x:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.kest-mbody { padding: 16px 22px; overflow: auto; flex: 1; min-height: 0; }
.kest-msum { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.kest-msum span { font-size: 12.5px; color: #64748b; background: #f8fafc; border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; }
.kest-msum span.on { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
.kest-maviso { font-size: 12.5px; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 9px 12px; margin-bottom: 14px; }
.kest-merr { font-size: 13px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 14px; }
.kest-msec + .kest-msec { margin-top: 18px; }
.kest-msec h3 { font-size: 13.5px; font-weight: 800; margin: 0 0 8px; }
.kest-msec h3 span { font-weight: 600; color: var(--warn); margin-left: 6px; font-size: 12px; }
.kest-mtablewrap { border: 1px solid var(--line); border-radius: 12px; overflow: auto; }
.kest-mtable { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 880px; table-layout: fixed; }
.kest-mtable th { background: #f8fafc; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 9px 10px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--line); }
.kest-mtable td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #475569; vertical-align: top; }
.kest-mtable tr:last-child td { border-bottom: 0; }
.kest-mtable .r { text-align: right; }
.kest-mtable td { overflow-wrap: anywhere; }
.kest-mtable td.num { font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #334155; }
.kest-mtable td.cli { color: #1e293b; font-weight: 600; }
.kest-mtable td.qtd { font-weight: 800; color: #1e293b; font-variant-numeric: tabular-nums; }
.kest-mtable td.dias { font-variant-numeric: tabular-nums; }
.kest-mtable tr.velho td { background: #fff7ed; }
.kest-mtable tr.velho td.dias { color: var(--warn); font-weight: 800; }
.kest-mfoot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 22px 16px; border-top: 1px solid var(--line); font-size: 12.5px; color: #64748b; }
.kest-mfoot b { color: var(--warn); }
.kest-mdl { display: flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 10px; border: 1px solid #16a34a; background: #16a34a; color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.kest-mdl:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 640px) { .kest-ov { padding: 10px; } .kest-mhead, .kest-mbody, .kest-mfoot { padding-left: 14px; padding-right: 14px; } }
`

export default function EstoquePage() {
  const router = useRouter()
  const [itens, setItens] = useState<EstoqueItem[] | null>(null)
  const [erro, setErro] = useState('')
  const [vendasErro, setVendasErro] = useState<string | null>(null)
  const [comprasErro, setComprasErro] = useState<string | null>(null)
  const [mileErro, setMileErro] = useState<string | null>(null)
  const [mileSemIntErro, setMileSemIntErro] = useState<string | null>(null)
  const [remessasErro, setRemessasErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [soBaixo, setSoBaixo] = useState(false)
  const [marca, setMarca] = useState('')
  // Pedidos parados por produto (pop-up ao clicar no código)
  const [pendencias, setPendencias] = useState<Record<string, PendenciaItem[]>>({})
  const [pendErro, setPendErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<EstoqueItem | null>(null)
  const fecharModal = useCallback(() => setAberto(null), [])

  const carregar = useCallback(() => {
    setErro('')
    fetch('/api/estoque')
      .then(res => { if (res.status === 401) { router.push('/login'); return null } return res.json() })
      .then(d => { if (!d) return; if (d.error) { setErro(String(d.error)); setItens([]); return } setItens(d.itens as EstoqueItem[]); setVendasErro(d.vendasErro ?? null); setComprasErro(d.comprasErro ?? null); setMileErro(d.mileErro ?? null); setMileSemIntErro(d.mileSemIntErro ?? null); setRemessasErro(d.remessasErro ?? null) })
      .catch(e => { setErro(String(e)); setItens([]) })
    // Em paralelo: se as pendências falharem, a tabela segue normal e o pop-up mostra o erro
    fetch('/api/estoque/pendencias')
      .then(res => res.json().then(d => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || d.error) { setPendErro(String(d.error || 'erro ao carregar')); setPendencias({}); return }
        const porProduto: Record<string, PendenciaItem[]> = {}
        for (const p of d.itens as PendenciaItem[]) (porProduto[p.productId] ??= []).push(p)
        setPendErro(null)
        setPendencias(porProduto)
      })
      .catch(e => { setPendErro(e instanceof Error ? e.message : String(e)); setPendencias({}) })
  }, [router])
  useEffect(() => { carregar() }, [carregar])

  // Código clicável se o produto tem pedido parado. Se a busca das pendências falhou,
  // continua clicável onde a linha mostra pendência, e o pop-up explica o erro.
  const temPendencia = (i: EstoqueItem) =>
    (pendencias[i.productId]?.length ?? 0) > 0 ||
    (!!pendErro && i.vendasSemInt + i.mileSemInt + i.tristarSemInt > 0)

  // Estoque lógico vem pronto do banco:
  // Est. Mile + Est. TriStar − vendas s/ integr. − Mile s/ integr. − TriStar rascunho − remessas não enviadas
  const estoqueLogico = (i: EstoqueItem) => i.estoqueLogico
  const status = (i: EstoqueItem) => i.status

  const marcas = useMemo(() => {
    const s = new Set((itens ?? []).map(i => i.marca).filter(Boolean))
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [itens])

  const linhas = useMemo(() => {
    if (!itens) return []
    return itens
      .filter(i => {
        if (marca && i.marca !== marca) return false
        if (busca && !(`${i.productId} ${i.produto} ${i.sku}`.toLowerCase().includes(busca.toLowerCase()))) return false
        if (soBaixo && estoqueLogico(i) >= 0) return false
        return true
      })
      .sort((a, b) => (Number(a.productId) || 0) - (Number(b.productId) || 0))
  }, [itens, busca, soBaixo, marca])

  const totalSkus = itens?.length ?? 0
  const totalUn = (itens ?? []).reduce((s, i) => s + Math.max(estoqueLogico(i), 0), 0)
  const negativos = (itens ?? []).filter(i => estoqueLogico(i) < 0).length
  const vendasTotal = (itens ?? []).reduce((s, i) => s + i.vendasSemInt, 0)

  return (
    <div className="kest-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppSidebar hideLogo />

      <main className="kest-main">
        <div className="kest-top">
          <div className="kest-brand"><VeddaraLogo height={70} /></div>
          <h1 className="kest-title"><em>Estoque</em></h1>
          <div className="kest-right">
            <button className="kest-refresh" title="Atualizar" aria-label="Atualizar" onClick={carregar}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        <div className="kest-prev">Estoque lógico ao vivo · clique no código do produto para ver os pedidos parados</div>

        {erro && <div className="kest-tablewrap" style={{ padding: 16, color: '#dc2626', fontSize: 13 }}>Erro ao carregar estoque: {erro}</div>}
        {vendasErro && <div className="kest-tablewrap" style={{ padding: 12, color: '#b45309', fontSize: 12.5 }}>⚠️ Vendas sem integração falhou: {vendasErro}</div>}
        {comprasErro && <div className="kest-tablewrap" style={{ padding: 12, color: '#b45309', fontSize: 12.5 }}>⚠️ Compras (planilha) falhou: {comprasErro}</div>}
        {mileErro && <div className="kest-tablewrap" style={{ padding: 12, color: '#b45309', fontSize: 12.5 }}>⚠️ Estoque Mile falhou: {mileErro}</div>}
        {mileSemIntErro && <div className="kest-tablewrap" style={{ padding: 12, color: '#b45309', fontSize: 12.5 }}>⚠️ Mile sem integração falhou: {mileSemIntErro}</div>}
        {remessasErro && <div className="kest-tablewrap" style={{ padding: 12, color: '#b45309', fontSize: 12.5 }}>⚠️ Remessas parciais (planilha) falhou: {remessasErro}</div>}

        {/* KPIs */}
        <div className="kest-kpis">
          <div className="kest-kpi"><div className="kest-kpi-lbl">Produtos (master)</div><div className="kest-kpi-val">{fmtNum(totalSkus)}</div></div>
          <div className="kest-kpi"><div className="kest-kpi-lbl">Estoque lógico (un.)</div><div className="kest-kpi-val">{fmtNum(totalUn)}</div></div>
          <div className="kest-kpi warn"><div className="kest-kpi-lbl">Estoque negativo</div><div className="kest-kpi-val">{negativos} <span style={{ fontSize: 12, fontWeight: 600 }}>SKUs</span></div></div>
          <div className="kest-kpi"><div className="kest-kpi-lbl">Vendas s/ integr. (un.)</div><div className="kest-kpi-val">{fmtNum(vendasTotal)}</div></div>
        </div>

        {/* Filtros */}
        <div className="kest-filters">
          <select className="kest-select" value={marca} onChange={e => setMarca(e.target.value)}>
            <option value="">Todas as marcas</option>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input className="kest-search" placeholder="🔍 Buscar produto, SKU ou código…" value={busca} onChange={e => setBusca(e.target.value)} />
          <label className="kest-toggle">
            <input type="checkbox" checked={soBaixo} onChange={e => setSoBaixo(e.target.checked)} />
            <span className="tk" /> Só estoque negativo
          </label>
          <button
            onClick={() => baixarEstoque(linhas)}
            disabled={!linhas.length}
            title="Baixar planilha (abre no Excel)"
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 15px', borderRadius: '10px', border: '1px solid #16a34a',
              background: '#16a34a', color: '#fff', cursor: linhas.length ? 'pointer' : 'not-allowed',
              opacity: linhas.length ? 1 : 0.5, fontFamily: 'inherit', fontSize: '13px', fontWeight: 700,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Baixar Excel
          </button>
        </div>

        {/* Tabela */}
        {!itens ? <div className="kest-sk" /> : (
          <div className="kest-tablewrap">
            <table className="kest-table">
              <thead>
                <tr>
                  <th className="l">Cód.</th>
                  <th className="l">Produto</th>
                  <th className="l">SKU</th>
                  <th>Est. inicial</th>
                  <th>Est. Mile</th>
                  <th>Est. TriStar</th>
                  <th>Vendas s/ integr.</th>
                  <th>Mile s/ integr.</th>
                  <th>TriStar rascunho</th>
                  <th>Compras</th>
                  <th>Remessa P não enviadas</th>
                  <th>Estoque</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((i, ix) => {
                  const est = estoqueLogico(i)
                  return (
                    <tr key={ix}>
                      <td className="sku" style={{ fontWeight: 700, color: '#334155' }}>
                        {temPendencia(i)
                          ? <button type="button" className="kest-codlink" onClick={() => setAberto(i)} title="Ver pedidos parados">{i.productId}</button>
                          : i.productId}
                      </td>
                      <td className="prod">{i.produto || '—'}</td>
                      <td className="sku">{i.sku || '—'}</td>
                      <td>{i.inicial || '—'}</td>
                      <td className="atual">{fmtNum(i.atual)}</td>
                      <td className="atual">{i.estTristar ? fmtNum(i.estTristar) : '—'}</td>
                      <td style={{ color: i.vendasSemInt > 0 ? '#ea580c' : '#94a3b8', fontWeight: i.vendasSemInt > 0 ? 700 : 400 }}>{i.vendasSemInt ? fmtNum(i.vendasSemInt) : '—'}</td>
                      <td style={{ color: i.mileSemInt > 0 ? '#ea580c' : '#94a3b8', fontWeight: i.mileSemInt > 0 ? 700 : 400 }}>{i.mileSemInt ? fmtNum(i.mileSemInt) : '—'}</td>
                      <td style={{ color: i.tristarSemInt > 0 ? '#ea580c' : '#94a3b8', fontWeight: i.tristarSemInt > 0 ? 700 : 400 }}>{i.tristarSemInt ? fmtNum(i.tristarSemInt) : '—'}</td>
                      <td style={{ color: i.compras > 0 ? '#16a34a' : '#94a3b8', fontWeight: i.compras > 0 ? 700 : 400 }}>{i.compras ? fmtNum(i.compras) : '—'}</td>
                      <td style={{ color: i.remessasNaoInt > 0 ? '#ea580c' : '#94a3b8', fontWeight: i.remessasNaoInt > 0 ? 700 : 400 }}>{i.remessasNaoInt ? fmtNum(i.remessasNaoInt) : '—'}</td>
                      <td className={`atual ${est < 0 ? 'neg' : ''}`}>{fmtNum(est)}</td>
                      <td style={{ textAlign: 'center' }}><span className={`kest-st ${status(i) === 'OK' ? 'ok' : 'nok'}`}>{status(i)}</span></td>
                    </tr>
                  )
                })}
                {linhas.length === 0 && <tr><td colSpan={13}><div className="kest-empty">Nenhum item com esses filtros.</div></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="kest-legend" style={{ fontSize: 11.5, color: '#94a3b8' }}><b>Estoque</b> = Est. Mile + Est. TriStar − Vendas s/ integr. − Mile s/ integr. − TriStar rascunho − Remessas não enviadas · <b className="ok" style={{ color: '#16a34a' }}>OK</b>/<b style={{ color: '#ea580c' }}>NOK</b> = conciliação (inicial + movimentos = Mile). Fontes ao vivo: Mile, vendas (Sybase), planilhas (master, compras, acertos, remessas).</div>
      </main>

      {aberto && (
        <PendenciasModal
          produto={aberto}
          linhas={pendencias[aberto.productId] ?? []}
          erro={pendErro}
          onClose={fecharModal}
        />
      )}
    </div>
  )
}
