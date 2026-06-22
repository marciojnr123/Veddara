'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Cell,
} from 'recharts'
import { AppSidebar, VeddaraLogo } from '@/components/AppSidebar'
import { Greeting } from '@/components/Greeting'
import { UserChip } from '@/components/UserChip'
import { DateFilter } from '@/components/DateFilter'
import type { DadosComercial } from '@/app/api/comercial/route'

function fmtMoeda(v: number): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2)} bi`
  if (v >= 1_000_000)     return `R$ ${(v / 1_000_000).toFixed(1)} mi`
  if (v >= 1_000)         return `R$ ${(v / 1_000).toFixed(0)} mil`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
function fmtMoedaFull(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}
function fmtNum(v: number): string {
  return v.toLocaleString('pt-BR')
}
function nomeMes(anomes: string): string {
  const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const ano = anomes.slice(0, 4)
  const mes = parseInt(anomes.slice(4), 10)
  return `${m[mes - 1]}/${ano.slice(2)}`
}

// Meta mensal de faturamento da empresa
const META_EMPRESA = 350_000

const ARC = 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831'
function MetaDonut({ valor, meta }: { valor: number; meta: number }) {
  const ratio = meta > 0 ? valor / meta : 0
  const dash = Math.min(ratio * 100, 100).toFixed(1)
  const pctLabel = Math.round(ratio * 100)
  return (
    <div className="kcom-meta">
      <svg className="kcom-meta-ring" viewBox="0 0 36 36">
        <path className="kcom-meta-track" d={ARC} />
        <path className="kcom-meta-prog" d={ARC} strokeDasharray={`${dash} 100`} />
        <text x="18" y="17" className="kcom-meta-pct">{pctLabel}%</text>
        <text x="18" y="22" className="kcom-meta-lbl">da meta</text>
      </svg>
      <div className="kcom-meta-sub">{fmtMoeda(valor)} de {fmtMoeda(meta)}</div>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

.kcom-root, .kcom-root * { box-sizing: border-box; }
.kcom-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  display: grid;
  grid-template-columns: 150px 1fr;
  min-height: 100vh;
  --bg: #f6f8fb;
  --surface: #ffffff;
  --surface-2: #f1f5f9;
  --ink: #1e293b;
  --ink-2: #475569;
  --ink-3: #94a3b8;
  --line: #e8edf3;
  --grad-a: #4B6FE4;
  --grad-b: #3EA8D8;
  --grad-c: #42C9BF;
  --radius: 18px;
  --radius-sm: 14px;
  --shadow-sm: 0 4px 20px rgba(30,50,90,.06);
  background:
    radial-gradient(1100px 620px at 0% -5%, #d8e6fb 0%, rgba(216,230,251,0) 55%),
    radial-gradient(1000px 600px at 100% -8%, #fbe2d4 0%, rgba(251,226,212,0) 52%),
    #f3f7fc;
  color: var(--ink);
}

.kcom-main { padding: 18px 30px 48px; display: flex; flex-direction: column; gap: 14px; min-width: 0; overflow-y: auto; }

.kcom-topbar { display: flex; align-items: center; justify-content: center; gap: 16px; position: relative; min-height: 42px; }
.kcom-brand-left { position: absolute; left: 0; top: 50%; transform: translateY(-50%); display: flex; align-items: center; }
.kcom-topbar-right { position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 10px; }
.kcom-refresh-round {
  width: 40px; height: 40px; border-radius: 50%;
  display: grid; place-items: center; cursor: pointer; flex-shrink: 0;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink-2);
  transition: background .12s, color .12s, transform .12s;
}
.kcom-refresh-round:hover { background: var(--surface-2); color: var(--ink); }
.kcom-refresh-round:active { transform: scale(.93); }

/* Donut da meta mensal */
.kcom-meta { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 2px; }
.kcom-meta-ring { width: 96px; height: 96px; }
.kcom-meta-track { fill: none; stroke: #eef2fb; stroke-width: 3.4; }
.kcom-meta-prog { fill: none; stroke: #3b6fe4; stroke-width: 3.4; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dasharray .6s ease; }
.kcom-meta-pct { fill: #3b6fe4; font-size: 8px; font-weight: 800; text-anchor: middle; font-family: inherit; }
.kcom-meta-lbl { fill: #94a3b8; font-size: 3.3px; font-weight: 600; text-anchor: middle; font-family: inherit; }
.kcom-meta-sub { font-size: 11.5px; color: #94a3b8; font-weight: 600; }
.kcom-title {
  font-family: 'Instrument Serif', serif;
  font-size: 38px; font-weight: 400; letter-spacing: -0.02em;
  margin: 0; line-height: 1; color: var(--ink);
}
.kcom-title em {
  font-style: italic;
  background: linear-gradient(90deg, #2f57c9, #4d82ef);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.kcom-sub { font-size: 13px; color: var(--ink-3); margin: 7px 0 0; }

/* Filtro de datas */
.kcom-filtros { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.kcom-date-group {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 10px; padding: 6px 10px;
}
.kcom-date-group label { font-size: 11px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: .03em; }
.kcom-date-input {
  border: 0; background: transparent; font-family: inherit;
  font-size: 12.5px; color: var(--ink); font-weight: 600;
  cursor: pointer; outline: none; color-scheme: light;
}
.kcom-presets { display: flex; gap: 4px; }
.kcom-preset {
  font-size: 12px; font-weight: 600; padding: 7px 12px;
  border-radius: 9px; border: 1px solid var(--line);
  background: var(--surface); color: var(--ink-2);
  cursor: pointer; font-family: inherit; transition: all .12s;
}
.kcom-preset:hover { background: var(--surface-2); }
.kcom-preset.active {
  background: linear-gradient(135deg, var(--grad-a), var(--grad-c));
  color: #fff; border-color: transparent;
}
.kcom-refresh {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600;
  cursor: pointer; font-family: inherit; border: 1px solid var(--line);
  background: var(--surface); color: var(--ink-2); transition: all .12s;
}
.kcom-refresh:hover { background: var(--surface-2); }

/* KPI Grid */
.kcom-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kcom-kpi {
  background: rgba(255,255,255,.74); border: 1px solid rgba(255,255,255,.7);
  border-radius: var(--radius); padding: 18px 20px; backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm); position: relative; overflow: hidden;
}
.kcom-kpi.hero {
  background: linear-gradient(115deg, #4361d8 0%, #5e69cd 52%, #c2848f 82%, #efa886 100%);
  border: 0;
}
.kcom-kpi.hero .kcom-kpi-label { color: rgba(255,255,255,.8); }
.kcom-kpi.hero .kcom-kpi-val   { color: #fff; }
.kcom-kpi.hero .kcom-kpi-sub   { color: rgba(255,255,255,.78); }
.kcom-kpi-label { font-size: 11.5px; font-weight: 600; color: var(--ink-3); margin-bottom: 9px; letter-spacing: .02em; text-transform: uppercase; }
.kcom-kpi-val   { font-size: 25px; font-weight: 800; color: var(--ink); letter-spacing: -0.02em; line-height: 1; }
.kcom-kpi-sub   { font-size: 11.5px; color: var(--ink-3); margin-top: 7px; display: flex; align-items: center; gap: 5px; }
.kcom-chip { font-weight: 700; padding: 1px 7px; border-radius: 999px; font-size: 11px; }
.kcom-chip.up   { background: #dcfce7; color: #16a34a; }
.kcom-chip.down { background: #fee2e2; color: #dc2626; }
.kcom-kpi.hero .kcom-chip.up { background: rgba(255,255,255,.22); color: #fff; }
.kcom-kpi.hero .kcom-chip.down { background: rgba(255,255,255,.22); color: #fff; }
.kcom-kpi-val.blue { color: #3b6fe4; }
.kcom-kpi.warn { background: linear-gradient(135deg, #fff6f0 0%, #fde9da 100%); border-color: #f8ddc6; }
.kcom-kpi.warn .kcom-kpi-label { color: #ef7e2e; }
.kcom-kpi.warn .kcom-kpi-val   { color: #f2802a; }
.kcom-kpi.warn .kcom-kpi-sub   { color: #e79a63; }

/* Cards */
.kcom-card {
  background: rgba(255,255,255,.74); border: 1px solid rgba(255,255,255,.7);
  border-radius: var(--radius); padding: 20px 22px; box-shadow: var(--shadow-sm);
  backdrop-filter: blur(10px);
}
.kcom-card-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.kcom-card-title { font-size: 14px; font-weight: 700; color: var(--ink); margin: 0; }
.kcom-card-note { font-size: 11.5px; color: var(--ink-3); font-weight: 500; }

.kcom-row2 { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; }
.kcom-row-eq { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* Ranking list */
.kcom-rank { display: flex; flex-direction: column; gap: 11px; }
.kcom-rank-row { display: flex; align-items: center; gap: 12px; }
.kcom-rank-pos {
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center; font-size: 12px; font-weight: 800;
  background: linear-gradient(135deg, #4b8ff0, #36b8e0); color: #fff;
}
.kcom-rank.vend .kcom-rank-pos { background: linear-gradient(135deg, #f7a44b, #ef7a2a); }
.kcom-rank-body { flex: 1; min-width: 0; }
.kcom-rank-name { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kcom-rank-meta { font-size: 11px; color: var(--ink-3); margin-top: 1px; }
.kcom-rank-bar-track { height: 6px; border-radius: 999px; background: var(--surface-2); margin-top: 5px; overflow: hidden; }
.kcom-rank-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #4b8ff0, #36b8e0); }
.kcom-rank.vend .kcom-rank-bar-fill { background: linear-gradient(90deg, #f7a44b, #ef7a2a); }
.kcom-rank-val { font-size: 12.5px; font-weight: 800; color: var(--ink); flex-shrink: 0; text-align: right; }
.kcom-empty { padding: 30px 10px; text-align: center; font-size: 12.5px; color: var(--ink-3); }

/* Funil */
.kcom-funil { display: flex; flex-direction: column; gap: 10px; }
.kcom-funil-row { display: flex; align-items: center; gap: 12px; }
.kcom-funil-bar {
  height: 38px; border-radius: 10px; display: flex; align-items: center;
  padding: 0 14px; color: #fff; font-weight: 700; font-size: 13px;
  min-width: 60px; transition: width .3s;
}
.kcom-funil-side { font-size: 12px; color: var(--ink-3); flex-shrink: 0; }
.kcom-funil-side b { color: var(--ink); font-size: 13px; }

/* Funil de conversão (camadas/trapézios contínuos) */
.kcom-funnel { display: flex; flex-direction: column; align-items: stretch; gap: 5px; padding: 10px 0 4px; }
.kcom-funnel-stage {
  color: #fff; text-align: center;
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 3px;
  filter: drop-shadow(0 2px 5px rgba(15, 23, 42, .18));
  transition: clip-path .3s;
}
.kcom-funnel-stage-main { font-size: 14.5px; font-weight: 800; letter-spacing: -.01em; }
.kcom-funnel-stage-sub { font-size: 12px; font-weight: 600; opacity: .95; }

/* Tabela produtos */
.kcom-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.kcom-tbl th {
  text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em;
  color: var(--ink-3); font-weight: 700; padding: 0 10px 10px; border-bottom: 1px solid var(--line);
}
.kcom-tbl th.r, .kcom-tbl td.r { text-align: right; }
.kcom-tbl td { padding: 11px 10px; border-bottom: 1px solid var(--line); color: var(--ink-2); }
.kcom-tbl tr:last-child td { border-bottom: 0; }
.kcom-tbl td.name { color: var(--ink); font-weight: 600; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kcom-tbl td.val { font-weight: 800; color: var(--ink); }

/* Skeleton */
.kcom-sk { border-radius: 12px; background: var(--surface-2); animation: kcom-pulse 1.4s ease-in-out infinite; }
@keyframes kcom-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }

@media (max-width: 1100px) {
  .kcom-kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .kcom-row2, .kcom-row-eq { grid-template-columns: 1fr; }
}
`

const AREA_GRAD_ID = 'kcom-area-grad'


export default function ComercialPage() {
  const router = useRouter()
  const [dados, setDados] = useState<DadosComercial | null>(null)
  const [erro, setErro] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  const carregar = useCallback((ini: string, f: string) => {
    setDados(null)
    setErro('')
    const params = new URLSearchParams()
    if (ini && f) { params.set('inicio', ini); params.set('fim', f) }
    const qs = params.toString()
    fetch(`/api/comercial${qs ? '?' + qs : ''}`)
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        if (data.error) { setErro(String(data.error)); return }
        setDados(data as DadosComercial)
      })
      .catch(e => setErro(String(e)))
  }, [router])

  useEffect(() => { carregar('', '') }, [carregar])

  function aplicarData(novoInicio: string, novoFim: string) {
    setInicio(novoInicio); setFim(novoFim)
    carregar(novoInicio, novoFim)
  }

  const tooltipStyle = {
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,.1)',
    padding: '8px 12px', fontSize: '12.5px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }
  const axisProps = {
    tick: { fontSize: 11, fill: 'var(--ink-3)', fontFamily: "'Plus Jakarta Sans', sans-serif" },
    axisLine: false as const,
    tickLine: false as const,
  }

  const k = dados?.kpis
  const temFiltro = !!(dados?.periodo.inicio && dados?.periodo.fim)
  const labelComparacao = temFiltro ? 'vs período anterior' : 'vs ano anterior'

  const maxCliente = Math.max(...(dados?.topClientes.map(c => c.faturamento) ?? [1]))
  const maxVendedor = Math.max(...(dados?.topVendedores.map(v => v.faturamento) ?? [1]))

  const funil = dados?.funil
  const funilMax = Math.max(funil?.convertidos ?? 1, funil?.perdidos ?? 1, funil?.abertos ?? 1)

  // quando o período é de um único mês, o backend manda faturamento diário
  const granularidade = dados?.granularidade ?? 'mensal'
  const serieFat: Array<{ label: string; faturamento: number; notas: number }> =
    granularidade === 'diario'
      ? (dados?.diario ?? []).map(d => ({ label: `${d.dia.slice(6, 8)}/${d.dia.slice(4, 6)}`, faturamento: d.faturamento, notas: d.notas }))
      : (dados?.mensal ?? []).map(m => ({ label: nomeMes(m.anomes), faturamento: m.faturamento, notas: m.notas }))
  const anualData = dados?.anual ?? []
  // Em mês único, o card "anual" vira comparação com o mesmo mês do ano passado
  const comp = dados?.compAnoAnterior ?? null
  const eMesUnico = granularidade === 'diario'
  const evolucaoData = eMesUnico && comp
    ? [
        { ano: comp.labelAnterior, faturamento: comp.fatAnterior },
        { ano: comp.labelAtual, faturamento: comp.fatAtual },
      ]
    : anualData

  return (
    <div className="kcom-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <AppSidebar hideLogo />

      <main className="kcom-main">

        {/* Header */}
        {/* Top bar: logo · filtro de data · atualizar */}
        <div className="kcom-topbar">
          <div className="kcom-brand-left"><VeddaraLogo height={48} /></div>
          <DateFilter onChange={aplicarData} />
          <div className="kcom-topbar-right">
            <button className="kcom-refresh-round" onClick={() => carregar(inicio, fim)} title="Atualizar" aria-label="Atualizar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <UserChip />
          </div>
        </div>

        {/* Saudação dinâmica com o nome do usuário logado */}
        <Greeting />

        {erro && (
          <div className="kcom-card" style={{ color: '#dc2626', fontSize: 13 }}>
            Erro ao carregar dados: {erro}
          </div>
        )}

        {/* KPIs */}
        <div className="kcom-kpi-grid">
          <div className="kcom-kpi hero">
            <div className="kcom-kpi-label">Faturamento {temFiltro ? 'do período' : 'total'}</div>
            {k ? (
              <>
                <div className="kcom-kpi-val">{fmtMoeda(k.faturamentoPeriodo)}</div>
                <div className="kcom-kpi-sub">
                  {k.faturamentoAnterior > 0 && (
                    <span className={`kcom-chip ${k.crescimentoPoP >= 0 ? 'up' : 'down'}`}>
                      {k.crescimentoPoP >= 0 ? '▲' : '▼'} {Math.abs(k.crescimentoPoP).toFixed(1)}%
                    </span>
                  )}
                  {labelComparacao}
                </div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>

          <div className="kcom-kpi">
            <div className="kcom-kpi-label">Faturas</div>
            {k ? (
              <>
                <div className="kcom-kpi-val">{fmtNum(k.notasPeriodo)}</div>
                <div className="kcom-kpi-sub">Documentos no período</div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>

          <div className="kcom-kpi">
            <div className="kcom-kpi-label">Ticket médio</div>
            {k ? (
              <>
                <div className="kcom-kpi-val">{fmtMoeda(k.ticketMedio)}</div>
                <div className="kcom-kpi-sub">Por nota fiscal</div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>

          <div className="kcom-kpi">
            <div className="kcom-kpi-label">Pipeline em aberto</div>
            {k ? (
              <>
                <div className="kcom-kpi-val">{fmtMoeda(k.pipelineAberto)}</div>
                <div className="kcom-kpi-sub">{fmtNum(k.pipelineQtd)} orçamentos aguardando</div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>

          <div className="kcom-kpi">
            <div className="kcom-kpi-label">Taxa de conversão</div>
            {k ? (
              <>
                <div className="kcom-kpi-val">{k.winRate.toFixed(1)}%</div>
                <div className="kcom-kpi-sub">Orçamentos ganhos vs perdidos</div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>

          {granularidade === 'diario' ? (
            <div className="kcom-kpi">
              <div className="kcom-kpi-label">Meta do mês <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>· {fmtMoeda(META_EMPRESA)}</span></div>
              {k ? (
                <MetaDonut valor={k.faturamentoPeriodo} meta={META_EMPRESA} />
              ) : <div className="kcom-sk" style={{ height: 40 }} />}
            </div>
          ) : (
            <div className="kcom-kpi">
              <div className="kcom-kpi-label">Orçamentos Faturados</div>
              {funil ? (
                <>
                  <div className="kcom-kpi-val blue">{fmtNum(funil.convertidos)}</div>
                  <div className="kcom-kpi-sub">Convertidos em pedido</div>
                </>
              ) : <div className="kcom-sk" style={{ height: 40 }} />}
            </div>
          )}

          <div className="kcom-kpi">
            <div className="kcom-kpi-label">Clientes ativos</div>
            {k ? (
              <>
                <div className="kcom-kpi-val">{fmtNum(k.clientesAtivos)}</div>
                <div className="kcom-kpi-sub">Base cadastral ativa (total)</div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>

          <div className="kcom-kpi warn">
            <div className="kcom-kpi-label">Orçamentos Cancelados</div>
            {funil ? (
              <>
                <div className="kcom-kpi-val">{fmtNum(funil.perdidos)}</div>
                <div className="kcom-kpi-sub">Cancelados / expirados</div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>
        </div>

        {/* Faturamento mensal + anual */}
        <div className="kcom-row2">
          <div className="kcom-card">
            <div className="kcom-card-hdr">
              <h3 className="kcom-card-title">{granularidade === 'diario' ? 'Faturamento diário' : 'Faturamento mensal'}</h3>
              <span className="kcom-card-note">{granularidade === 'diario' ? 'Por dia no mês' : (temFiltro ? 'Dentro do período' : 'Últimos ~24 meses')}</span>
            </div>
            {!dados ? <div className="kcom-sk" style={{ height: 260 }} />
              : serieFat.length === 0 ? <div className="kcom-empty" style={{ height: 260, display: 'grid', placeItems: 'center' }}>Sem dados no período</div>
              : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={serieFat} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={AREA_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6f9bf0" stopOpacity={0.30} />
                      <stop offset="100%" stopColor="#6f9bf0" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="kcom-line-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b6fe4" />
                      <stop offset="62%" stopColor="#4b7ae8" />
                      <stop offset="100%" stopColor="#ef7a2a" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
                  <YAxis tickFormatter={fmtAxis} {...axisProps} width={42} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [fmtMoedaFull(Number(v)), 'Faturamento']}
                    labelStyle={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}
                  />
                  <Area type="monotone" dataKey="faturamento" stroke="url(#kcom-line-grad)" strokeWidth={2.5} fill={`url(#${AREA_GRAD_ID})`} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="kcom-card">
            <div className="kcom-card-hdr">
              <h3 className="kcom-card-title">{eMesUnico && comp ? 'Comparação Ano Passado' : 'Evolução anual'}</h3>
              <span className="kcom-card-note">{eMesUnico && comp ? 'Mesmo mês no ano anterior' : 'Faturamento por ano'}</span>
            </div>
            {!dados ? <div className="kcom-sk" style={{ height: 260 }} />
              : evolucaoData.length === 0 ? <div className="kcom-empty" style={{ height: 260, display: 'grid', placeItems: 'center' }}>Sem dados no período</div>
              : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={evolucaoData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="kcom-bar-blue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4b8ff0" />
                      <stop offset="100%" stopColor="#33c2e2" />
                    </linearGradient>
                    <linearGradient id="kcom-bar-orange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f7a44b" />
                      <stop offset="100%" stopColor="#ef7a2a" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="ano" {...axisProps} />
                  <YAxis tickFormatter={fmtAxis} {...axisProps} width={42} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'var(--surface-2)' }}
                    formatter={(v) => [fmtMoedaFull(Number(v)), 'Faturamento']}
                    labelStyle={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}
                  />
                  <Bar dataKey="faturamento" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {evolucaoData.map((_, i) => (
                      <Cell key={i} fill={i === evolucaoData.length - 1 ? 'url(#kcom-bar-orange)' : 'url(#kcom-bar-blue)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top clientes + Top vendedores */}
        <div className="kcom-row-eq">
          <div className="kcom-card">
            <div className="kcom-card-hdr">
              <h3 className="kcom-card-title">Top 10 clientes</h3>
              <span className="kcom-card-note">Por faturamento</span>
            </div>
            {!dados ? <div className="kcom-sk" style={{ height: 360 }} />
              : dados.topClientes.length === 0 ? <div className="kcom-empty">Sem dados no período</div>
              : (
              <div className="kcom-rank">
                {dados.topClientes.map((c, i) => (
                  <div className="kcom-rank-row" key={c.nome + i}>
                    <div className={`kcom-rank-pos ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                    <div className="kcom-rank-body">
                      <div className="kcom-rank-name" title={c.nome}>{c.nome}</div>
                      <div className="kcom-rank-meta">{fmtNum(c.notas)} notas</div>
                      <div className="kcom-rank-bar-track">
                        <div className="kcom-rank-bar-fill" style={{ width: `${(c.faturamento / maxCliente) * 100}%` }} />
                      </div>
                    </div>
                    <div className="kcom-rank-val">{fmtMoeda(c.faturamento)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="kcom-card">
            <div className="kcom-card-hdr">
              <h3 className="kcom-card-title">Top 10 vendedores</h3>
              <span className="kcom-card-note">Por faturamento</span>
            </div>
            {!dados ? <div className="kcom-sk" style={{ height: 360 }} />
              : dados.topVendedores.length === 0 ? <div className="kcom-empty">Sem dados no período</div>
              : (
              <div className="kcom-rank vend">
                {dados.topVendedores.map((v, i) => (
                  <div className="kcom-rank-row" key={v.nome + i}>
                    <div className={`kcom-rank-pos ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                    <div className="kcom-rank-body">
                      <div className="kcom-rank-name" title={v.nome}>{v.nome}</div>
                      <div className="kcom-rank-meta">{fmtNum(v.notas)} notas</div>
                      <div className="kcom-rank-bar-track">
                        <div className="kcom-rank-bar-fill" style={{ width: `${(v.faturamento / maxVendedor) * 100}%` }} />
                      </div>
                    </div>
                    <div className="kcom-rank-val">{fmtMoeda(v.faturamento)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Funil + Novos clientes */}
        <div className="kcom-row2">
          <div className="kcom-card">
            <div className="kcom-card-hdr">
              <h3 className="kcom-card-title">Funil de conversão</h3>
              <span className="kcom-card-note">{temFiltro ? 'No período' : 'Histórico'}</span>
            </div>
            {funil ? (() => {
              const totalFunil = funil.convertidos + funil.abertos + funil.perdidos
              const stages = [
                { label: 'Orçamentos com Fatura', val: funil.convertidos, grad: 'linear-gradient(135deg,#3b6fe4,#4b8ff0)' },
                { label: 'Orçamentos Perdidos', val: funil.perdidos, grad: 'linear-gradient(135deg,#ef7a2a,#f7a44b)' },
                { label: 'Em aberto', val: funil.abertos, grad: 'linear-gradient(135deg,#36b8e0,#5bd0d0)' },
              ]
              const maxV = Math.max(...stages.map(s => s.val), 1)
              const larg = (v: number) => 34 + (v / maxV) * 66 // 34%..100%
              return (
                <div className="kcom-funnel">
                  {stages.map((s, i) => {
                    const topW = larg(s.val)
                    const botW = i < stages.length - 1 ? larg(stages[i + 1].val) : topW
                    const clip = `polygon(${(100 - topW) / 2}% 0, ${(100 + topW) / 2}% 0, ${(100 + botW) / 2}% 100%, ${(100 - botW) / 2}% 100%)`
                    const pct = totalFunil > 0 ? (s.val / totalFunil) * 100 : 0
                    return (
                      <div key={s.label} className="kcom-funnel-stage" style={{ background: s.grad, clipPath: clip, WebkitClipPath: clip }}>
                        <div className="kcom-funnel-stage-main">{s.label}</div>
                        <div className="kcom-funnel-stage-sub">{fmtNum(s.val)} · {pct.toFixed(1)}%</div>
                      </div>
                    )
                  })}
                </div>
              )
            })() : <div className="kcom-sk" style={{ height: 160 }} />}
          </div>

          <div className="kcom-card">
            <div className="kcom-card-hdr">
              <h3 className="kcom-card-title">Aquisição de clientes</h3>
              <span className="kcom-card-note">Novos cadastros por ano</span>
            </div>
            {!dados ? <div className="kcom-sk" style={{ height: 160 }} />
              : dados.novosClientes.length === 0 ? <div className="kcom-empty" style={{ height: 160, display: 'grid', placeItems: 'center' }}>Sem dados no período</div>
              : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dados.novosClientes} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="ano" {...axisProps} />
                  <YAxis tickFormatter={fmtAxis} {...axisProps} width={36} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'var(--surface-2)' }}
                    formatter={(v) => [fmtNum(Number(v)), 'Novos clientes']}
                    labelStyle={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}
                  />
                  <Bar dataKey="qtd" radius={[5, 5, 0, 0]} maxBarSize={40}>
                    {dados.novosClientes.map((_, i) => (
                      <Cell key={i} fill={i === dados.novosClientes.length - 1 ? '#42C9BF' : '#4B6FE4'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top produtos/serviços */}
        <div className="kcom-card">
          <div className="kcom-card-hdr">
            <h3 className="kcom-card-title">Top 10 produtos & serviços</h3>
            <span className="kcom-card-note">Por faturamento no período</span>
          </div>
          {!dados ? <div className="kcom-sk" style={{ height: 320 }} />
            : dados.topProdutos.length === 0 ? <div className="kcom-empty">Sem dados no período</div>
            : (
            <table className="kcom-tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Produto / Serviço</th>
                  <th className="r">Faturamento</th>
                  <th className="r" style={{ width: 90 }}>% do período</th>
                </tr>
              </thead>
              <tbody>
                {dados.topProdutos.map((p, i) => (
                  <tr key={p.nome + i}>
                    <td>{i + 1}</td>
                    <td className="name" title={p.nome}>{p.nome}</td>
                    <td className="r val">{fmtMoedaFull(p.faturamento)}</td>
                    <td className="r">{((p.faturamento / (k?.faturamentoPeriodo || 1)) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
