'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Cell,
} from 'recharts'
import { AppSidebar } from '@/components/AppSidebar'
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
function fmtDataBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

.kcom-root, .kcom-root * { box-sizing: border-box; }
.kcom-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  display: grid;
  grid-template-columns: 260px 1fr;
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
  --shadow-sm: 0 1px 3px rgba(15,23,42,.05);
  background: var(--bg);
  color: var(--ink);
}

.kcom-main { padding: 26px 30px 48px; display: flex; flex-direction: column; gap: 20px; min-width: 0; overflow-y: auto; }

.kcom-topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.kcom-title {
  font-family: 'Instrument Serif', serif;
  font-size: 38px; font-weight: 400; letter-spacing: -0.02em;
  margin: 0; line-height: 1; color: var(--ink);
}
.kcom-title em {
  font-style: italic;
  background: linear-gradient(90deg, var(--grad-a), var(--grad-b), var(--grad-c));
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
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius-sm); padding: 18px 20px;
  box-shadow: var(--shadow-sm); position: relative; overflow: hidden;
}
.kcom-kpi.hero {
  background: linear-gradient(135deg, #4B6FE4 0%, #3EA8D8 55%, #42C9BF 100%);
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

/* Cards */
.kcom-card {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 20px 22px; box-shadow: var(--shadow-sm);
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
  width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0;
  display: grid; place-items: center; font-size: 11px; font-weight: 800;
  background: var(--surface-2); color: var(--ink-3);
}
.kcom-rank-pos.top { background: linear-gradient(135deg, var(--grad-a), var(--grad-c)); color: #fff; }
.kcom-rank-body { flex: 1; min-width: 0; }
.kcom-rank-name { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kcom-rank-meta { font-size: 11px; color: var(--ink-3); margin-top: 1px; }
.kcom-rank-bar-track { height: 6px; border-radius: 999px; background: var(--surface-2); margin-top: 5px; overflow: hidden; }
.kcom-rank-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--grad-a), var(--grad-c)); }
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

const BAR_GRAD_ID = 'kcom-bar-grad'
const AREA_GRAD_ID = 'kcom-area-grad'

// Presets de período
function isoHoje(): string { return new Date().toISOString().slice(0, 10) }
function isoAnoMesDia(a: number, m: number, d: number): string {
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function ComercialPage() {
  const router = useRouter()
  const [dados, setDados] = useState<DadosComercial | null>(null)
  const [erro, setErro] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [presetAtivo, setPresetAtivo] = useState<string>('tudo')

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

  function aplicarPreset(preset: string) {
    setPresetAtivo(preset)
    const hoje = new Date()
    const ano = hoje.getFullYear()
    let ini = '', f = ''
    if (preset === 'tudo') { ini = ''; f = '' }
    else if (preset === 'ano') { ini = isoAnoMesDia(ano, 1, 1); f = isoHoje() }
    else if (preset === 'anopassado') { ini = isoAnoMesDia(ano - 1, 1, 1); f = isoAnoMesDia(ano - 1, 12, 31) }
    else if (preset === '12m') {
      const d = new Date(hoje); d.setFullYear(d.getFullYear() - 1)
      ini = d.toISOString().slice(0, 10); f = isoHoje()
    }
    setInicio(ini); setFim(f)
    carregar(ini, f)
  }

  function aplicarManual(novoInicio: string, novoFim: string) {
    setInicio(novoInicio); setFim(novoFim)
    setPresetAtivo(novoInicio && novoFim ? 'custom' : 'tudo')
    if (novoInicio && novoFim) carregar(novoInicio, novoFim)
    else if (!novoInicio && !novoFim) carregar('', '')
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
  const labelPeriodo = temFiltro && dados
    ? `${fmtDataBR(dados.periodo.inicio!)} – ${fmtDataBR(dados.periodo.fim!)}`
    : 'Histórico completo'
  const labelComparacao = temFiltro ? 'vs período anterior' : 'vs ano anterior'

  const maxCliente = Math.max(...(dados?.topClientes.map(c => c.faturamento) ?? [1]))
  const maxVendedor = Math.max(...(dados?.topVendedores.map(v => v.faturamento) ?? [1]))

  const funil = dados?.funil
  const funilMax = Math.max(funil?.convertidos ?? 1, funil?.perdidos ?? 1, funil?.abertos ?? 1)

  const mensalData = dados?.mensal.map(m => ({ ...m, label: nomeMes(m.anomes) })) ?? []
  const anualData = dados?.anual ?? []

  const presets = [
    { id: 'tudo', label: 'Tudo' },
    { id: 'ano', label: 'Este ano' },
    { id: 'anopassado', label: 'Ano passado' },
    { id: '12m', label: '12 meses' },
  ]

  return (
    <div className="kcom-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <AppSidebar />

      <main className="kcom-main">

        {/* Header */}
        <div className="kcom-topbar">
          <div>
            <h1 className="kcom-title">Visão <em>Comercial Veddara</em></h1>
            <p className="kcom-sub">Período: <strong>{labelPeriodo}</strong> · dados reais Sybase IQ</p>
          </div>
          <button className="kcom-refresh" onClick={() => carregar(inicio, fim)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Atualizar
          </button>
        </div>

        {/* Filtros de data */}
        <div className="kcom-filtros">
          <div className="kcom-presets">
            {presets.map(p => (
              <button
                key={p.id}
                className={`kcom-preset ${presetAtivo === p.id ? 'active' : ''}`}
                onClick={() => aplicarPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="kcom-date-group">
            <label>De</label>
            <input
              type="date"
              className="kcom-date-input"
              value={inicio}
              max={fim || undefined}
              onChange={e => aplicarManual(e.target.value, fim)}
            />
          </div>
          <div className="kcom-date-group">
            <label>Até</label>
            <input
              type="date"
              className="kcom-date-input"
              value={fim}
              min={inicio || undefined}
              onChange={e => aplicarManual(inicio, e.target.value)}
            />
          </div>
          {temFiltro && (
            <button className="kcom-refresh" onClick={() => aplicarPreset('tudo')}>
              Limpar
            </button>
          )}
        </div>

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
            <div className="kcom-kpi-label">Notas emitidas</div>
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

          <div className="kcom-kpi">
            <div className="kcom-kpi-label">Orçamentos ganhos</div>
            {funil ? (
              <>
                <div className="kcom-kpi-val">{fmtNum(funil.convertidos)}</div>
                <div className="kcom-kpi-sub">Convertidos em pedido</div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>

          <div className="kcom-kpi">
            <div className="kcom-kpi-label">Clientes ativos</div>
            {k ? (
              <>
                <div className="kcom-kpi-val">{fmtNum(k.clientesAtivos)}</div>
                <div className="kcom-kpi-sub">Base cadastral ativa (total)</div>
              </>
            ) : <div className="kcom-sk" style={{ height: 40 }} />}
          </div>

          <div className="kcom-kpi">
            <div className="kcom-kpi-label">Orçamentos perdidos</div>
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
              <h3 className="kcom-card-title">Faturamento mensal</h3>
              <span className="kcom-card-note">{temFiltro ? 'Dentro do período' : 'Últimos ~24 meses'}</span>
            </div>
            {!dados ? <div className="kcom-sk" style={{ height: 260 }} />
              : mensalData.length === 0 ? <div className="kcom-empty" style={{ height: 260, display: 'grid', placeItems: 'center' }}>Sem dados no período</div>
              : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={mensalData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={AREA_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3EA8D8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#42C9BF" stopOpacity={0.02} />
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
                  <Area type="monotone" dataKey="faturamento" stroke="#3EA8D8" strokeWidth={2.5} fill={`url(#${AREA_GRAD_ID})`} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="kcom-card">
            <div className="kcom-card-hdr">
              <h3 className="kcom-card-title">Evolução anual</h3>
              <span className="kcom-card-note">Faturamento por ano</span>
            </div>
            {!dados ? <div className="kcom-sk" style={{ height: 260 }} />
              : anualData.length === 0 ? <div className="kcom-empty" style={{ height: 260, display: 'grid', placeItems: 'center' }}>Sem dados no período</div>
              : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={anualData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={BAR_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4B6FE4" />
                      <stop offset="100%" stopColor="#42C9BF" />
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
                  <Bar dataKey="faturamento" fill={`url(#${BAR_GRAD_ID})`} radius={[6, 6, 0, 0]} maxBarSize={48} />
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
              <div className="kcom-rank">
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
              <h3 className="kcom-card-title">Funil de orçamentos</h3>
              <span className="kcom-card-note">{temFiltro ? 'No período' : 'Histórico'}</span>
            </div>
            {funil ? (
              <div className="kcom-funil">
                <div className="kcom-funil-row">
                  <div className="kcom-funil-bar" style={{ width: `${Math.max((funil.convertidos / funilMax) * 100, 6)}%`, background: 'linear-gradient(90deg,#16a34a,#22c55e)' }}>
                    {fmtNum(funil.convertidos)}
                  </div>
                  <div className="kcom-funil-side"><b>Ganhos</b> · convertidos em pedido</div>
                </div>
                <div className="kcom-funil-row">
                  <div className="kcom-funil-bar" style={{ width: `${Math.max((funil.abertos / funilMax) * 100, 6)}%`, background: 'linear-gradient(90deg,#4B6FE4,#3EA8D8)' }}>
                    {fmtNum(funil.abertos)}
                  </div>
                  <div className="kcom-funil-side"><b>Em aberto</b> · {fmtMoeda(funil.valorPipeline)} em pipeline</div>
                </div>
                <div className="kcom-funil-row">
                  <div className="kcom-funil-bar" style={{ width: `${Math.max((funil.perdidos / funilMax) * 100, 6)}%`, background: 'linear-gradient(90deg,#dc2626,#f87171)' }}>
                    {fmtNum(funil.perdidos)}
                  </div>
                  <div className="kcom-funil-side"><b>Perdidos</b> · cancelados/expirados</div>
                </div>
              </div>
            ) : <div className="kcom-sk" style={{ height: 160 }} />}
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
