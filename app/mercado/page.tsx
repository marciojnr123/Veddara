'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Legend,
} from 'recharts'
import { AppSidebar } from '@/components/AppSidebar'
import type { DadosMercado } from '@/app/api/mercado/route'

/* ---------- helpers de formatação ---------- */
function fmtMoeda(v: number): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2)} bi`
  if (v >= 1_000_000)     return `R$ ${(v / 1_000_000).toFixed(1)} mi`
  if (v >= 1_000)         return `R$ ${(v / 1_000).toFixed(0)} mil`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}
function fmtNum(v: number): string { return v.toLocaleString('pt-BR') }
function fmtDataBR(iso: string): string { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}` }
function isoHoje(): string { return new Date().toISOString().slice(0, 10) }
function isoAnoMesDia(a: number, m: number, d: number): string {
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/* ---------- dados FICTÍCIOS (apenas consignado + recompra, por enquanto) ---------- */
const MESES_MODALIDADE = [
  { label: 'Jul/25', direta: 880000, consignado: 120000 },
  { label: 'Ago/25', direta: 920000, consignado: 140000 },
  { label: 'Set/25', direta: 870000, consignado: 160000 },
  { label: 'Out/25', direta: 1010000, consignado: 175000 },
  { label: 'Nov/25', direta: 1180000, consignado: 210000 },
  { label: 'Dez/25', direta: 1340000, consignado: 260000 },
  { label: 'Jan/26', direta: 940000, consignado: 150000 },
  { label: 'Fev/26', direta: 1020000, consignado: 165000 },
  { label: 'Mar/26', direta: 1120000, consignado: 190000 },
  { label: 'Abr/26', direta: 1060000, consignado: 180000 },
  { label: 'Mai/26', direta: 1210000, consignado: 220000 },
  { label: 'Jun/26', direta: 1280000, consignado: 240000 },
]
const RECOMPRA = [
  { label: 'Jul/25', clientes: 320 }, { label: 'Ago/25', clientes: 358 },
  { label: 'Set/25', clientes: 372 }, { label: 'Out/25', clientes: 410 },
  { label: 'Nov/25', clientes: 468 }, { label: 'Dez/25', clientes: 540 },
  { label: 'Jan/26', clientes: 395 }, { label: 'Fev/26', clientes: 430 },
  { label: 'Mar/26', clientes: 472 }, { label: 'Abr/26', clientes: 455 },
  { label: 'Mai/26', clientes: 512 }, { label: 'Jun/26', clientes: 560 },
]

/* ---------- escala de cor do mapa ---------- */
function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t) }
function clamp01(t: number) { return t < 0 ? 0 : t > 1 ? 1 : t }
function colorFor(v: number, min: number, max: number): string {
  if (v <= 0) return '#eef3fc' // sem venda
  const t = clamp01(max > min ? Math.pow((v - min) / (max - min), 0.6) : 0.5)
  const r = lerp(0xdb, 0x1d, t), g = lerp(0xea, 0x4e, t), b = lerp(0xfe, 0xd8, t)
  return `rgb(${r},${g},${b})`
}

interface UF { sigla: string; name: string; regiao: string; d: string }
interface GeoData { width: number; height: number; states: UF[] }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

.kmkt-root, .kmkt-root * { box-sizing: border-box; }
.kmkt-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  display: grid;
  grid-template-columns: 150px 1fr;
  min-height: 100vh;
  --ink: #0f172a;
  --ink-2: #475569;
  --ink-3: #94a3b8;
  --line: #e8edf3;
  --blue: #2563EB;
  --blue-d: #1d4ed8;
  --cyan: #22C3DD;
  --orange: #F97316;
  --orange-d: #ea580c;
  --radius: 18px;
  --radius-sm: 14px;
  --shadow: 0 10px 30px rgba(30,50,90,.08);
  color: var(--ink);
  background: linear-gradient(135deg, #eaf1fc 0%, #f2f6fc 45%, #fdeee7 100%);
  background-attachment: fixed;
}

.kmkt-main { padding: 26px 30px 48px; display: flex; flex-direction: column; gap: 18px; min-width: 0; overflow-y: auto; }

.kmkt-topbar { text-align: center; position: relative; }
.kmkt-title {
  font-family: 'Instrument Serif', serif;
  font-size: 38px; font-weight: 400; letter-spacing: -0.02em;
  margin: 0; line-height: 1.05; color: var(--ink);
}
.kmkt-title em {
  font-style: italic;
  background: linear-gradient(90deg, var(--blue), var(--cyan));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.kmkt-sub { font-size: 13px; color: var(--ink-3); margin: 8px 0 0; }
.kmkt-refresh {
  position: absolute; right: 0; top: 0;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600;
  cursor: pointer; font-family: inherit; border: 1px solid var(--line);
  background: rgba(255,255,255,.7); color: var(--ink-2);
}

.kmkt-filtros { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
.kmkt-presets { display: flex; gap: 4px; }
.kmkt-preset {
  font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 9px;
  border: 1px solid var(--line); background: rgba(255,255,255,.7); color: var(--ink-2);
  cursor: pointer; font-family: inherit; transition: all .12s;
}
.kmkt-preset.active { background: linear-gradient(135deg, var(--blue), var(--cyan)); color: #fff; border-color: transparent; }
.kmkt-date-group { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.7); border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; }
.kmkt-date-group label { font-size: 11px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: .03em; }
.kmkt-date-input { border: 0; background: transparent; font-family: inherit; font-size: 12.5px; color: var(--ink); font-weight: 600; cursor: pointer; outline: none; color-scheme: light; }

.kmkt-card {
  background: rgba(255,255,255,.72); border: 1px solid rgba(255,255,255,.8);
  border-radius: var(--radius); padding: 20px 22px; box-shadow: var(--shadow);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.kmkt-card-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.kmkt-card-title { font-size: 14px; font-weight: 700; color: var(--ink); margin: 0; }
.kmkt-card-note { font-size: 11.5px; color: var(--ink-3); font-weight: 500; }

.kmkt-row-map { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; }
.kmkt-row-cons { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }

.kmkt-map-wrap { position: relative; width: 100%; }
.kmkt-map-svg { width: 100%; height: auto; display: block; }
.kmkt-map-svg path { stroke: #ffffff; stroke-width: 0.8; cursor: pointer; transition: opacity .12s; }
.kmkt-map-svg path:hover { opacity: .82; }
.kmkt-map-tip {
  position: absolute; pointer-events: none; z-index: 5;
  background: #0f172a; color: #fff; font-size: 12px; font-weight: 600;
  padding: 6px 10px; border-radius: 8px; white-space: nowrap;
  transform: translate(-50%, -120%);
}
.kmkt-map-tip span { display: block; font-weight: 500; color: #cbd5e1; font-size: 11px; }
.kmkt-legend { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--ink-3); }
.kmkt-legend-bar { width: 130px; height: 8px; border-radius: 999px; background: linear-gradient(90deg, #dbeafe, #1d4ed8); }

.kmkt-rank { display: flex; flex-direction: column; gap: 11px; }
.kmkt-rank-row { display: flex; align-items: center; gap: 12px; }
.kmkt-rank-pos { width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: #eef3fc; color: var(--ink-3); }
.kmkt-rank-pos.top { background: linear-gradient(135deg, var(--blue), var(--cyan)); color: #fff; }
.kmkt-rank-body { flex: 1; min-width: 0; }
.kmkt-rank-name { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.kmkt-rank-bar-track { height: 6px; border-radius: 999px; background: #eef3fc; margin-top: 5px; overflow: hidden; }
.kmkt-rank-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--blue), var(--cyan)); }
.kmkt-rank-val { font-size: 12.5px; font-weight: 800; color: var(--ink); flex-shrink: 0; text-align: right; }
.kmkt-empty { padding: 30px 10px; text-align: center; font-size: 12.5px; color: var(--ink-3); }

.kmkt-hero-stat { background: linear-gradient(135deg, var(--orange) 0%, var(--orange-d) 100%); border-radius: var(--radius-sm); padding: 18px 20px; color: #fff; margin-bottom: 14px; }
.kmkt-hero-stat .big { font-size: 34px; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
.kmkt-hero-stat .txt { font-size: 12px; color: rgba(255,255,255,.9); margin-top: 8px; line-height: 1.5; }
.kmkt-mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.kmkt-mini { background: rgba(255,255,255,.6); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
.kmkt-mini-label { font-size: 10.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: .03em; }
.kmkt-mini-val { font-size: 20px; font-weight: 800; color: var(--ink); margin-top: 5px; letter-spacing: -.02em; }
.kmkt-mini.orange .kmkt-mini-val { color: var(--orange-d); }

.kmkt-sk { border-radius: 12px; background: #eef3fc; animation: kmkt-pulse 1.4s ease-in-out infinite; }
@keyframes kmkt-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

@media (max-width: 1100px) {
  .kmkt-row-map, .kmkt-row-cons { grid-template-columns: 1fr; }
}
`

const presets = [
  { id: 'tudo', label: 'Tudo' },
  { id: 'ano', label: 'Este ano' },
  { id: 'anopassado', label: 'Ano passado' },
]

export default function MercadoPage() {
  const router = useRouter()
  const [geo, setGeo] = useState<GeoData | null>(null)
  const [dados, setDados] = useState<DadosMercado | null>(null)
  const [erro, setErro] = useState('')
  const [hover, setHover] = useState<{ x: number; y: number; sigla: string; name: string; val: number } | null>(null)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [mes, setMes] = useState('')
  const [presetAtivo, setPresetAtivo] = useState('tudo')

  // carrega a geometria do mapa uma vez
  useEffect(() => {
    fetch('/br-uf-paths.json').then(r => r.json()).then(setGeo).catch(() => {})
  }, [])

  const carregar = useCallback((ini: string, f: string) => {
    setDados(null)
    setErro('')
    const params = new URLSearchParams()
    if (ini && f) { params.set('inicio', ini); params.set('fim', f) }
    const qs = params.toString()
    fetch(`/api/mercado${qs ? '?' + qs : ''}`)
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        if (data.error) { setErro(String(data.error)); return }
        setDados(data as DadosMercado)
      })
      .catch(e => setErro(String(e)))
  }, [router])

  useEffect(() => { carregar('', '') }, [carregar])

  function aplicarPreset(preset: string) {
    setPresetAtivo(preset)
    setMes('')
    const hoje = new Date()
    const ano = hoje.getFullYear()
    let ini = '', f = ''
    if (preset === 'tudo') { ini = ''; f = '' }
    else if (preset === 'ano') { ini = isoAnoMesDia(ano, 1, 1); f = isoHoje() }
    else if (preset === 'anopassado') { ini = isoAnoMesDia(ano - 1, 1, 1); f = isoAnoMesDia(ano - 1, 12, 31) }
    setInicio(ini); setFim(f)
    carregar(ini, f)
  }

  function aplicarMes(valor: string) {
    setMes(valor)
    if (!valor) { aplicarPreset('tudo'); return }
    const [a, m] = valor.split('-').map(Number)
    const ultimoDia = new Date(a, m, 0).getDate()
    const ini = isoAnoMesDia(a, m, 1)
    const f = isoAnoMesDia(a, m, ultimoDia)
    setInicio(ini); setFim(f); setPresetAtivo('mes')
    carregar(ini, f)
  }

  function aplicarManual(novoInicio: string, novoFim: string) {
    setInicio(novoInicio); setFim(novoFim); setMes('')
    setPresetAtivo(novoInicio && novoFim ? 'custom' : 'tudo')
    if (novoInicio && novoFim) carregar(novoInicio, novoFim)
    else if (!novoInicio && !novoFim) carregar('', '')
  }

  // mapa uf -> faturamento (dados reais)
  const vendas: Record<string, number> = {}
  for (const v of dados?.vendasPorEstado ?? []) vendas[v.uf] = v.faturamento
  const valoresPos = Object.values(vendas).filter(v => v > 0)
  const minV = valoresPos.length ? Math.min(...valoresPos) : 0
  const maxV = valoresPos.length ? Math.max(...valoresPos) : 1

  const topEstados = (geo?.states ?? [])
    .map(s => ({ ...s, val: vendas[s.sigla] ?? 0 }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 8)
  const maxTop = topEstados[0]?.val || 1

  const temFiltro = !!(inicio && fim)
  const labelPeriodo = temFiltro ? `${fmtDataBR(inicio)} – ${fmtDataBR(fim)}` : 'Histórico completo'

  const tooltipStyle = {
    background: 'rgba(255,255,255,.96)', border: '1px solid var(--line)',
    borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,.1)',
    padding: '8px 12px', fontSize: '12.5px', fontFamily: "'Plus Jakarta Sans', sans-serif",
  }
  const axisProps = {
    tick: { fontSize: 11, fill: 'var(--ink-3)', fontFamily: "'Plus Jakarta Sans', sans-serif" },
    axisLine: false as const, tickLine: false as const,
  }

  return (
    <div className="kmkt-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <AppSidebar />

      <main className="kmkt-main">
        {/* Header */}
        <div className="kmkt-topbar">
          <h1 className="kmkt-title">Análise <em>Geográfica &amp; Recompra</em></h1>
          <p className="kmkt-sub">Período: <strong>{labelPeriodo}</strong> · dados reais Sybase IQ</p>
          <button className="kmkt-refresh" onClick={() => carregar(inicio, fim)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Atualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="kmkt-filtros">
          <div className="kmkt-presets">
            {presets.map(p => (
              <button key={p.id} className={`kmkt-preset ${presetAtivo === p.id ? 'active' : ''}`} onClick={() => aplicarPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="kmkt-date-group">
            <label>Mês</label>
            <input type="month" className="kmkt-date-input" value={mes} onChange={e => aplicarMes(e.target.value)} />
          </div>
          <div className="kmkt-date-group"><label>De</label>
            <input type="date" className="kmkt-date-input" value={inicio} max={fim || undefined} onChange={e => aplicarManual(e.target.value, fim)} />
          </div>
          <div className="kmkt-date-group"><label>Até</label>
            <input type="date" className="kmkt-date-input" value={fim} min={inicio || undefined} onChange={e => aplicarManual(inicio, e.target.value)} />
          </div>
        </div>

        {erro && (
          <div className="kmkt-card" style={{ color: '#dc2626', fontSize: 13 }}>
            Erro ao carregar dados: {erro}
          </div>
        )}

        {/* Mapa + Top estados */}
        <div className="kmkt-row-map">
          <div className="kmkt-card">
            <div className="kmkt-card-hdr">
              <div>
                <h3 className="kmkt-card-title">Vendas por estado</h3>
                <span className="kmkt-card-note">Faturamento acumulado por UF</span>
              </div>
              <div className="kmkt-legend">Menos <span className="kmkt-legend-bar" /> Mais</div>
            </div>
            {!geo || !dados ? <div className="kmkt-sk" style={{ height: 420 }} /> : (
              <div className="kmkt-map-wrap" onMouseLeave={() => setHover(null)}>
                <svg className="kmkt-map-svg" viewBox={`0 0 ${geo.width} ${geo.height}`}>
                  {geo.states.map(s => {
                    const v = vendas[s.sigla] ?? 0
                    return (
                      <path
                        key={s.sigla}
                        d={s.d}
                        fill={colorFor(v, minV, maxV)}
                        onMouseMove={e => {
                          const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect()
                          setHover({ x: e.clientX - box.left, y: e.clientY - box.top, sigla: s.sigla, name: s.name, val: v })
                        }}
                      />
                    )
                  })}
                </svg>
                {hover && (
                  <div className="kmkt-map-tip" style={{ left: hover.x, top: hover.y }}>
                    {hover.name} ({hover.sigla})
                    <span>{hover.val > 0 ? fmtMoeda(hover.val) : 'sem vendas no período'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="kmkt-card">
            <div className="kmkt-card-hdr">
              <h3 className="kmkt-card-title">Top estados</h3>
              <span className="kmkt-card-note">Por faturamento</span>
            </div>
            {!geo || !dados ? <div className="kmkt-sk" style={{ height: 420 }} />
              : topEstados.every(e => e.val === 0) ? <div className="kmkt-empty">Sem vendas no período</div>
              : (
              <div className="kmkt-rank">
                {topEstados.map((e, i) => (
                  <div className="kmkt-rank-row" key={e.sigla}>
                    <div className={`kmkt-rank-pos ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                    <div className="kmkt-rank-body">
                      <div className="kmkt-rank-name">{e.sigla} · {e.name}</div>
                      <div className="kmkt-rank-bar-track">
                        <div className="kmkt-rank-bar-fill" style={{ width: `${(e.val / maxTop) * 100}%` }} />
                      </div>
                    </div>
                    <div className="kmkt-rank-val">{fmtMoeda(e.val)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Consignado vs venda direta + Resumo (ainda dados de exemplo) */}
        <div className="kmkt-row-cons">
          <div className="kmkt-card">
            <div className="kmkt-card-hdr">
              <h3 className="kmkt-card-title">Consignado vs venda direta</h3>
              <span className="kmkt-card-note">Faturamento mensal por modalidade · dados de exemplo</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={MESES_MODALIDADE} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tickFormatter={fmtAxis} {...axisProps} width={42} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [fmtMoeda(Number(v)), n === 'direta' ? 'Venda direta' : 'Consignado']} labelStyle={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
                <Legend formatter={v => v === 'direta' ? 'Venda direta' : 'Consignado'} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="direta" stackId="a" fill="#2563EB" maxBarSize={36} />
                <Bar dataKey="consignado" stackId="a" fill="#F97316" radius={[5, 5, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="kmkt-card">
            <div className="kmkt-card-hdr">
              <h3 className="kmkt-card-title">Resumo consignado</h3>
              <span className="kmkt-card-note">exemplo</span>
            </div>
            <div className="kmkt-hero-stat">
              <div className="big">78%</div>
              <div className="txt">Dos itens enviados em consignação, 78% se converteram em venda no período.</div>
            </div>
            <div className="kmkt-mini-grid">
              <div className="kmkt-mini orange"><div className="kmkt-mini-label">Vendas consignadas</div><div className="kmkt-mini-val">R$ 1.2 mi</div></div>
              <div className="kmkt-mini"><div className="kmkt-mini-label">% do faturamento</div><div className="kmkt-mini-val">14.2%</div></div>
              <div className="kmkt-mini orange"><div className="kmkt-mini-label">Devoluções</div><div className="kmkt-mini-val">22%</div></div>
              <div className="kmkt-mini"><div className="kmkt-mini-label">Consign. em aberto</div><div className="kmkt-mini-val">R$ 286 mil</div></div>
            </div>
          </div>
        </div>

        {/* Evolução de recompra (ainda dados de exemplo) */}
        <div className="kmkt-card">
          <div className="kmkt-card-hdr">
            <div>
              <h3 className="kmkt-card-title">Evolução de recompra</h3>
              <span className="kmkt-card-note">Clientes que voltaram a comprar · por mês · dados de exemplo</span>
            </div>
            <span className="kmkt-card-note" style={{ color: '#16a34a', fontWeight: 700 }}>▲ taxa de recompra 41%</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={RECOMPRA} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="kmkt-recompra" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22C3DD" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tickFormatter={fmtNum} {...axisProps} width={42} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtNum(Number(v)), 'Clientes recompra']} labelStyle={{ color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }} />
              <Area type="monotone" dataKey="clientes" stroke="#2563EB" strokeWidth={2.5} fill="url(#kmkt-recompra)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </main>
    </div>
  )
}
