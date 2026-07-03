'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppSidebar, VeddaraLogo } from '@/components/AppSidebar'
import type { EstoqueItem } from '@/app/api/estoque/route'

function fmtNum(v: number): string { return v.toLocaleString('pt-BR') }

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
.kest-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #475569; font-variant-numeric: tabular-nums; }
.kest-table tr:last-child td { border-bottom: 0; }
.kest-table td.prod { text-align: left; color: #1e293b; font-weight: 600; max-width: 380px; }
.kest-table td.sku { text-align: left; color: var(--ink-3); }
.kest-table td.atual { font-weight: 800; color: #1e293b; }
.kest-table td.atual.low { color: var(--warn); }
.kest-table tbody tr:hover td { background: #f8fbff; }
.kest-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; background: #fff7ed; color: var(--warn); }
.kest-empty { padding: 40px; text-align: center; color: var(--ink-3); font-size: 13.5px; }
.kest-sk { height: 300px; border-radius: 16px; background: linear-gradient(90deg,#f1f5f9,#f8fafc,#f1f5f9); background-size: 200% 100%; animation: kestpulse 1.3s ease-in-out infinite; }
@keyframes kestpulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
`

export default function EstoquePage() {
  const router = useRouter()
  const [itens, setItens] = useState<EstoqueItem[] | null>(null)
  const [erro, setErro] = useState('')
  const [vendasErro, setVendasErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [soBaixo, setSoBaixo] = useState(false)

  const carregar = useCallback(() => {
    setErro('')
    fetch('/api/estoque')
      .then(res => { if (res.status === 401) { router.push('/login'); return null } return res.json() })
      .then(d => { if (!d) return; if (d.error) { setErro(String(d.error)); setItens([]); return } setItens(d.itens as EstoqueItem[]); setVendasErro(d.vendasErro ?? null) })
      .catch(e => { setErro(String(e)); setItens([]) })
  }, [router])
  useEffect(() => { carregar() }, [carregar])

  const baixo = (i: EstoqueItem) => i.minimo > 0 && i.atual <= i.minimo

  const linhas = useMemo(() => {
    if (!itens) return []
    return itens
      .filter(i => {
        if (busca && !(`${i.produto} ${i.sku}`.toLowerCase().includes(busca.toLowerCase()))) return false
        if (soBaixo && !baixo(i)) return false
        return true
      })
      .sort((a, b) => a.atual - b.atual)
  }, [itens, busca, soBaixo])

  const totalSkus = itens?.length ?? 0
  const totalUn = (itens ?? []).reduce((s, i) => s + Math.max(i.atual, 0), 0)
  const totalReservado = (itens ?? []).reduce((s, i) => s + i.reservado, 0)
  const abaixoMin = (itens ?? []).filter(baixo).length

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

        <div className="kest-prev">Fase 2 · estoque Mile + vendas sem integração ao vivo · ainda falta inicial/compras (planilhas)</div>

        {erro && <div className="kest-tablewrap" style={{ padding: 16, color: '#dc2626', fontSize: 13 }}>Erro ao carregar estoque: {erro}</div>}
        {vendasErro && <div className="kest-tablewrap" style={{ padding: 12, color: '#b45309', fontSize: 12.5 }}>⚠️ Estoque da Mile ok, mas a query de vendas sem integração falhou: {vendasErro}</div>}

        {/* KPIs */}
        <div className="kest-kpis">
          <div className="kest-kpi"><div className="kest-kpi-lbl">SKUs na Mile</div><div className="kest-kpi-val">{fmtNum(totalSkus)}</div></div>
          <div className="kest-kpi"><div className="kest-kpi-lbl">Estoque total (un.)</div><div className="kest-kpi-val">{fmtNum(totalUn)}</div></div>
          <div className="kest-kpi"><div className="kest-kpi-lbl">Reservado (un.)</div><div className="kest-kpi-val">{fmtNum(totalReservado)}</div></div>
          <div className="kest-kpi warn"><div className="kest-kpi-lbl">Abaixo do mínimo</div><div className="kest-kpi-val">{abaixoMin} <span style={{ fontSize: 12, fontWeight: 600 }}>SKUs</span></div></div>
        </div>

        {/* Filtros */}
        <div className="kest-filters">
          <input className="kest-search" placeholder="🔍 Buscar produto ou SKU…" value={busca} onChange={e => setBusca(e.target.value)} />
          <label className="kest-toggle">
            <input type="checkbox" checked={soBaixo} onChange={e => setSoBaixo(e.target.checked)} />
            <span className="tk" /> Só abaixo do mínimo
          </label>
        </div>

        {/* Tabela */}
        {!itens ? <div className="kest-sk" /> : (
          <div className="kest-tablewrap">
            <table className="kest-table">
              <thead>
                <tr>
                  <th className="l">Produto</th>
                  <th className="l">SKU</th>
                  <th>Est. atual</th>
                  <th>Reservado</th>
                  <th>Disponível</th>
                  <th>Mínimo</th>
                  <th>Vendas s/ integr.</th>
                  <th style={{ textAlign: 'center' }}>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((i, ix) => (
                  <tr key={ix}>
                    <td className="prod">{i.produto || '—'}</td>
                    <td className="sku">{i.sku || '—'}</td>
                    <td className={`atual ${baixo(i) ? 'low' : ''}`}>{fmtNum(i.atual)}</td>
                    <td>{i.reservado ? fmtNum(i.reservado) : '—'}</td>
                    <td>{fmtNum(i.disponivel)}</td>
                    <td>{i.minimo || '—'}</td>
                    <td style={{ color: i.vendasSemInt > 0 ? '#ea580c' : '#94a3b8', fontWeight: i.vendasSemInt > 0 ? 700 : 400 }}>{i.vendasSemInt ? fmtNum(i.vendasSemInt) : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{baixo(i) ? <span className="kest-badge">baixo</span> : ''}</td>
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td colSpan={8}><div className="kest-empty">Nenhum item com esses filtros.</div></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="kest-legend" style={{ fontSize: 11.5, color: '#94a3b8' }}>Dados ao vivo da tabela <b>TB_MILE_EXPRESS_ESTOQUE</b> (Mile). Próxima fase: cruzar vendas, estoque inicial, compras e integração para o estoque lógico + OK/NOK.</div>
      </main>
    </div>
  )
}
