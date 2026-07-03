'use client'

import { useState, useMemo } from 'react'
import { AppSidebar, VeddaraLogo } from '@/components/AppSidebar'

/* ---------- helpers ---------- */
function fmtNum(v: number): string { return v.toLocaleString('pt-BR') }

// Linha de estoque (dados de EXEMPLO — depois ligamos nas fontes reais)
interface LinhaEstoque {
  produto: string
  marca: string
  lote: string
  inicial: number
  mile: number
  vendasSemInt: number
  mileSemInt: number
  compras: number
  enviado: number
}
// estoque final = inicial + compras − vendas s/ integração − mile s/ integração − enviado (+ mile?)
// (fórmula exata será confirmada na fase de dados)
function estoqueFinal(l: LinhaEstoque): number {
  return l.inicial + l.compras - l.vendasSemInt - l.mileSemInt - l.enviado
}
// OK/NOK: (saldo + vendas s/int + compras − enviado) + mile s/int == mile físico
function status(l: LinhaEstoque): 'OK' | 'NOK' {
  const recalc = (estoqueFinal(l) + l.vendasSemInt + l.compras - l.enviado) + l.mileSemInt
  return recalc === l.mile ? 'OK' : 'NOK'
}

const DADOS_EXEMPLO: LinhaEstoque[] = [
  { produto: 'NRG Capsulas Veganas Full Spectrum 2400mg', marca: 'Neurogan', lote: '850012535607', inicial: 4, mile: 2, vendasSemInt: 7, mileSemInt: 5, compras: 0, enviado: 0 },
  { produto: 'NRG Capsulas Sleep Therapy 2700mg + 1200 CBN', marca: 'Neurogan', lote: '810068551037', inicial: 4, mile: 4, vendasSemInt: 0, mileSemInt: 0, compras: 0, enviado: 0 },
  { produto: 'NRG Capsulas Extra Forte 7500mg', marca: 'Neurogan', lote: '810068551044', inicial: 1, mile: 1, vendasSemInt: 3, mileSemInt: 3, compras: 0, enviado: 0 },
  { produto: 'NRG Gummies Full Spectrum 1350mg/30', marca: 'Neurogan', lote: '850015842306', inicial: 19, mile: 7, vendasSemInt: 14, mileSemInt: 0, compras: 0, enviado: 0 },
  { produto: 'NRG Gummies Sleep Full 1350mg/30', marca: 'Neurogan', lote: '850015842788', inicial: 22, mile: 23, vendasSemInt: 18, mileSemInt: 12, compras: 0, enviado: 0 },
  { produto: 'NRG Gummies Sativa Full Spectrum 3600mg', marca: 'Neurogan', lote: '810068551082', inicial: 53, mile: 53, vendasSemInt: 0, mileSemInt: 0, compras: 0, enviado: 0 },
  { produto: 'NRG Gummies Full 1350mg CBG e 200 CBD', marca: 'Neurogan', lote: '810068550078', inicial: 29, mile: 48, vendasSemInt: 5, mileSemInt: 0, compras: 50, enviado: 0 },
  { produto: 'Bala de Goma CBD 22,5 + CBG Balance 30g', marca: 'Neurogan', lote: '810068550177', inicial: 10, mile: 0, vendasSemInt: 0, mileSemInt: 0, compras: 0, enviado: 0 },
  { produto: 'NRG Óleo Broad Spectrum Citrus 2000mg', marca: 'Neurogan', lote: '850012535294', inicial: 11, mile: 39, vendasSemInt: 56, mileSemInt: 17, compras: 0, enviado: 0 },
  { produto: 'NRG Óleo Full Spectrum Natural 2000mg', marca: 'Neurogan', lote: '850009438454', inicial: 5, mile: 44, vendasSemInt: 24, mileSemInt: 17, compras: 0, enviado: 0 },
  { produto: 'BioHealth Pure Chill Drops 3000mg', marca: 'BioHealth', lote: '850044120018', inicial: 0, mile: 50, vendasSemInt: 2, mileSemInt: 0, compras: 50, enviado: 0 },
]

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
.kest-upd { font-size: 12px; color: var(--ink-3); }
.kest-upd b { color: #64748b; }
.kest-refresh { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: #fff; color: #64748b; display: grid; place-items: center; cursor: pointer; }
.kest-refresh:hover { background: #f8fafc; color: #1e293b; }

.kest-prev { align-self: center; font-size: 11.5px; font-weight: 700; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 999px; padding: 4px 12px; }

.kest-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kest-kpi { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 16px 18px; box-shadow: 0 6px 22px rgba(15,23,42,.05); }
.kest-kpi-lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
.kest-kpi-val { font-size: 27px; font-weight: 800; margin-top: 4px; letter-spacing: -.02em; }
.kest-kpi.danger { background: #fff1f2; border-color: #fecdd3; }
.kest-kpi.danger .kest-kpi-lbl, .kest-kpi.danger .kest-kpi-val { color: var(--danger); }
.kest-kpi.warn { background: #fff7ed; border-color: #fed7aa; }
.kest-kpi.warn .kest-kpi-lbl, .kest-kpi.warn .kest-kpi-val { color: var(--warn); }

.kest-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.kest-search { flex: 1; min-width: 200px; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 9px 14px; font-size: 13.5px; font-family: inherit; color: #1e293b; outline: none; }
.kest-search:focus { border-color: var(--blue); }
.kest-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #fff; }
.kest-seg button { border: 0; background: transparent; padding: 8px 14px; font-size: 12.5px; font-weight: 700; color: #64748b; cursor: pointer; font-family: inherit; border-left: 1px solid var(--line); }
.kest-seg button:first-child { border-left: 0; }
.kest-seg button.on { background: linear-gradient(135deg, var(--blue), var(--cyan)); color: #fff; }
.kest-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; cursor: pointer; user-select: none; }
.kest-toggle input { display: none; }
.kest-toggle .tk { width: 34px; height: 19px; border-radius: 999px; background: #cbd5e1; position: relative; transition: background .15s; }
.kest-toggle .tk::after { content: ''; position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: #fff; transition: transform .15s; }
.kest-toggle input:checked + .tk { background: var(--blue); }
.kest-toggle input:checked + .tk::after { transform: translateX(15px); }

.kest-tablewrap { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: auto; box-shadow: 0 6px 22px rgba(15,23,42,.05); }
.kest-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 900px; }
.kest-table thead th { background: #f8fafc; color: #64748b; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 11px 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
.kest-table thead th.l { text-align: left; }
.kest-table td { padding: 10px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #475569; font-variant-numeric: tabular-nums; }
.kest-table tr:last-child td { border-bottom: 0; }
.kest-table td.prod { text-align: left; color: #1e293b; font-weight: 600; max-width: 260px; }
.kest-table td.prod .mk { font-size: 10.5px; color: var(--ink-3); font-weight: 500; }
.kest-table td.lote { text-align: left; color: var(--ink-3); }
.kest-table td.est { font-weight: 800; color: #1e293b; }
.kest-table td.est.neg { color: var(--danger); }
.kest-table tbody tr:hover td { background: #f8fbff; }
.kest-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
.kest-badge.ok { background: #ecfdf5; color: var(--ok); }
.kest-badge.nok { background: #fff7ed; color: var(--warn); }
.kest-empty { padding: 40px; text-align: center; color: var(--ink-3); font-size: 13.5px; }
.kest-legend { font-size: 11.5px; color: var(--ink-3); }
.kest-legend b.neg { color: var(--danger); } .kest-legend b.nok { color: var(--warn); }
`

export default function EstoquePage() {
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ok' | 'nok'>('todos')
  const [soNeg, setSoNeg] = useState(false)

  const linhas = useMemo(() => {
    return DADOS_EXEMPLO
      .map(l => ({ ...l, final: estoqueFinal(l), st: status(l) }))
      .filter(l => {
        if (busca && !(`${l.produto} ${l.lote}`.toLowerCase().includes(busca.toLowerCase()))) return false
        if (statusFiltro === 'ok' && l.st !== 'OK') return false
        if (statusFiltro === 'nok' && l.st !== 'NOK') return false
        if (soNeg && l.final >= 0) return false
        return true
      })
      .sort((a, b) => a.final - b.final) // problemas (negativos) primeiro
  }, [busca, statusFiltro, soNeg])

  const totalSkus = DADOS_EXEMPLO.length
  const totalUn = DADOS_EXEMPLO.reduce((s, l) => s + Math.max(estoqueFinal(l), 0), 0)
  const negativos = DADOS_EXEMPLO.filter(l => estoqueFinal(l) < 0).length
  const noks = DADOS_EXEMPLO.filter(l => status(l) === 'NOK').length

  return (
    <div className="kest-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppSidebar hideLogo />

      <main className="kest-main">
        {/* Header */}
        <div className="kest-top">
          <div className="kest-brand"><VeddaraLogo height={70} /></div>
          <h1 className="kest-title"><em>Estoque</em></h1>
          <div className="kest-right">
            <span className="kest-upd">Atualizado em <b>02/07/2026</b></span>
            <button className="kest-refresh" title="Atualizar" aria-label="Atualizar">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        <div className="kest-prev">Prévia · dados de exemplo (ainda não ligado às fontes reais)</div>

        {/* KPIs */}
        <div className="kest-kpis">
          <div className="kest-kpi"><div className="kest-kpi-lbl">SKUs monitorados</div><div className="kest-kpi-val">{fmtNum(totalSkus)}</div></div>
          <div className="kest-kpi"><div className="kest-kpi-lbl">Estoque total (un.)</div><div className="kest-kpi-val">{fmtNum(totalUn)}</div></div>
          <div className="kest-kpi danger"><div className="kest-kpi-lbl">Estoque negativo</div><div className="kest-kpi-val">{negativos} <span style={{ fontSize: 12, fontWeight: 600 }}>SKUs</span></div></div>
          <div className="kest-kpi warn"><div className="kest-kpi-lbl">Divergências (NOK)</div><div className="kest-kpi-val">{noks}</div></div>
        </div>

        {/* Filtros */}
        <div className="kest-filters">
          <input className="kest-search" placeholder="🔍 Buscar produto ou lote…" value={busca} onChange={e => setBusca(e.target.value)} />
          <div className="kest-seg">
            <button className={statusFiltro === 'todos' ? 'on' : ''} onClick={() => setStatusFiltro('todos')}>Todos</button>
            <button className={statusFiltro === 'ok' ? 'on' : ''} onClick={() => setStatusFiltro('ok')}>OK</button>
            <button className={statusFiltro === 'nok' ? 'on' : ''} onClick={() => setStatusFiltro('nok')}>NOK</button>
          </div>
          <label className="kest-toggle">
            <input type="checkbox" checked={soNeg} onChange={e => setSoNeg(e.target.checked)} />
            <span className="tk" /> Só negativos
          </label>
        </div>

        {/* Tabela */}
        <div className="kest-tablewrap">
          <table className="kest-table">
            <thead>
              <tr>
                <th className="l">Produto</th>
                <th className="l">Lote</th>
                <th>Est. inicial</th>
                <th>Est. Mile</th>
                <th>Vendas s/ integr.</th>
                <th>Mile s/ integr.</th>
                <th>Compras</th>
                <th>Enviado</th>
                <th>Estoque</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>
                  <td className="prod">{l.produto}<div className="mk">{l.marca}</div></td>
                  <td className="lote">{l.lote}</td>
                  <td>{l.inicial || '—'}</td>
                  <td>{l.mile || '—'}</td>
                  <td>{l.vendasSemInt || '—'}</td>
                  <td>{l.mileSemInt || '—'}</td>
                  <td>{l.compras || '—'}</td>
                  <td>{l.enviado || '—'}</td>
                  <td className={`est ${l.final < 0 ? 'neg' : ''}`}>{l.final}</td>
                  <td style={{ textAlign: 'center' }}><span className={`kest-badge ${l.st === 'OK' ? 'ok' : 'nok'}`}>{l.st}</span></td>
                </tr>
              ))}
              {linhas.length === 0 && <tr><td colSpan={10}><div className="kest-empty">Nenhum item com esses filtros.</div></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="kest-legend">Estoque em <b className="neg">vermelho</b> = negativo · <b className="nok">NOK</b> = conciliação não bateu (algo não integrou)</div>
      </main>
    </div>
  )
}
