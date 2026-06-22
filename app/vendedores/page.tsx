'use client'

import { useState, useRef, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { AppSidebar, VeddaraLogo } from '@/components/AppSidebar'
import { DateFilter } from '@/components/DateFilter'

/* ---------- helpers ---------- */
function fmtMoeda(v: number): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2)} bi`
  if (v >= 1_000_000)     return `R$ ${(v / 1_000_000).toFixed(1)} mi`
  if (v >= 1_000)         return `R$ ${(v / 1_000).toFixed(0)} mil`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
function fmtMoedaFull(v: number): string { return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` }
function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}
function fmtNum(v: number): string { return v.toLocaleString('pt-BR') }

/* ---------- dados de EXEMPLO (layout — banco offline) ---------- */
type Cat = 'b2b' | 'b2c' | 'sem'
interface Vend { id: number; nome: string; cat: Cat; fat: number; notas: number; ganhos: number; perdidos: number; comissao: number; clientes: number }
// B2C: Fabio, Lygia, Denis, Ingrid (meta R$ 20k/mês) · Sem representante: Carina, Bianca, Vendas da Veddara · resto = B2B
// (faturamento ainda é exemplo — banco offline)
const META_B2C = 20_000
const VENDEDORES: Vend[] = [
  { id: 1, nome: 'Rodrigo Mendes',  cat: 'b2b', fat: 2_540_000, notas: 320, ganhos: 180, perdidos: 22, comissao: 76_200, clientes: 96 },
  { id: 2, nome: 'Carla Santos',    cat: 'b2b', fat: 1_900_000, notas: 245, ganhos: 140, perdidos: 25, comissao: 57_000, clientes: 73 },
  { id: 3, nome: 'Bruno Almeida',   cat: 'b2b', fat: 1_600_000, notas: 210, ganhos: 120, perdidos: 28, comissao: 48_000, clientes: 65 },
  { id: 4, nome: 'Thiago Rocha',    cat: 'b2b', fat: 1_180_000, notas: 160, ganhos: 95,  perdidos: 20, comissao: 35_400, clientes: 49 },
  { id: 5, nome: 'Fabio Pinheiro',  cat: 'b2c', fat: 360_000, notas: 240, ganhos: 90, perdidos: 14, comissao: 10_800, clientes: 120 },
  { id: 6, nome: 'Lygia Rodrigues', cat: 'b2c', fat: 300_000, notas: 205, ganhos: 78, perdidos: 12, comissao: 9_000,  clientes: 102 },
  { id: 7, nome: 'Denis Comisso',   cat: 'b2c', fat: 260_000, notas: 180, ganhos: 70, perdidos: 16, comissao: 7_800,  clientes: 88 },
  { id: 8, nome: 'Ingrid Fragoso',  cat: 'b2c', fat: 220_000, notas: 150, ganhos: 60, perdidos: 11, comissao: 6_600,  clientes: 74 },
  { id: 9,  nome: 'Carina Cavalheiro',          cat: 'sem', fat: 320_000, notas: 210, ganhos: 0, perdidos: 0, comissao: 0, clientes: 140 },
  { id: 10, nome: 'Vendas da Veddara',          cat: 'sem', fat: 240_000, notas: 170, ganhos: 0, perdidos: 0, comissao: 0, clientes: 110 },
  { id: 11, nome: 'Bianca M. Pereira da Costa', cat: 'sem', fat: 180_000, notas: 95,  ganhos: 0, perdidos: 0, comissao: 0, clientes: 60 },
]
const CAT_LABEL: Record<Cat, string> = { b2b: 'B2B', b2c: 'B2C', sem: 'Sem representante' }
const MESES = ['Jul/25', 'Ago/25', 'Set/25', 'Out/25', 'Nov/25', 'Dez/25', 'Jan/26', 'Fev/26', 'Mar/26', 'Abr/26', 'Mai/26', 'Jun/26']
// B2B x B2C x sem vendedor (faturamento por mês)
const MODALIDADE = MESES.map((label, i) => ({
  label,
  b2b: 900_000 + i * 55_000 + (i % 3) * 60_000,
  b2c: 520_000 + i * 30_000 + (i % 2) * 40_000,
  semVend: 180_000 + (i % 4) * 25_000,
}))
// evolução histórica de um vendedor (por ano)
const EVOLUCAO_HIST = [
  { ano: '2021', faturamento: 1_100_000 }, { ano: '2022', faturamento: 1_650_000 },
  { ano: '2023', faturamento: 2_050_000 }, { ano: '2024', faturamento: 2_380_000 },
  { ano: '2025', faturamento: 2_720_000 }, { ano: '2026', faturamento: 2_540_000 },
]
const TOP_VENDAS = [
  { cliente: 'Construtora Horizonte Ltda', data: '12/06/2026', valor: 184_500 },
  { cliente: 'Clínica Saúde Integral',     data: '03/06/2026', valor: 142_000 },
  { cliente: 'Supermercados Bela Vista',   data: '28/05/2026', valor: 121_300 },
  { cliente: 'Indústria Metalúrgica SP',   data: '19/05/2026', valor: 98_700 },
  { cliente: 'Distribuidora Nova Era',     data: '07/05/2026', valor: 76_400 },
]
const TOP_PRODUTOS = [
  { produto: 'NRG OLEO FULL 2000MG/30ML', qtd: 420, fat: 540_000 },
  { produto: 'BIOHEALTH SLEEP GUMMIES',   qtd: 360, fat: 410_000 },
  { produto: 'NRG OLEO BROAD 2000MG',     qtd: 295, fat: 358_000 },
  { produto: 'PURE CHILL DROPS 3000MG',   qtd: 210, fat: 246_000 },
  { produto: 'BIOHEALTH BALANCED THC',    qtd: 160, fat: 188_000 },
]
// sazonalidade do vendedor (faturamento por mês — pico em dezembro)
const SAZONALIDADE = MESES.map((label, i) => ({ label, fat: 140_000 + (i % 5) * 38_000 + (i === 5 ? 130_000 : 0) }))
const CLIENTES_MIX = { novos: 28, recompra: 72 }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

.kvnd-root, .kvnd-root * { box-sizing: border-box; }
.kvnd-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  display: grid; grid-template-columns: 150px 1fr; min-height: 100vh;
  --ink: #0f172a; --ink-2: #475569; --ink-3: #94a3b8; --line: #e8edf3;
  --blue: #2563EB; --cyan: #22C3DD; --orange: #F97316; --orange-d: #ea580c; --green: #16a34a;
  --radius: 18px; --radius-sm: 14px; --shadow: 0 10px 30px rgba(30,50,90,.08);
  color: var(--ink); background: linear-gradient(135deg, #eaf1fc 0%, #f2f6fc 45%, #fdeee7 100%); background-attachment: fixed;
}
.kvnd-main { padding: 26px 30px 48px; display: flex; flex-direction: column; gap: 18px; min-width: 0; overflow-y: auto; }

.kvnd-topbar { text-align: center; position: relative; }
.kvnd-brand-left { position: absolute; left: 0; top: 50%; transform: translateY(-50%); display: flex; align-items: center; }
.kvnd-title { font-family: 'Instrument Serif', serif; font-size: 38px; font-weight: 400; letter-spacing: -0.02em; margin: 0; line-height: 1.05; }
.kvnd-title em { font-style: italic; background: linear-gradient(90deg, var(--blue), var(--cyan)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.kvnd-sub { font-size: 13px; color: var(--ink-3); margin: 8px 0 0; }
.kvnd-tag { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--orange-d); background: #fff1e7; padding: 3px 9px; border-radius: 999px; }

.kvnd-filtros { display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; }

/* dropdown de vendedor */
.vsel { position: relative; font-family: inherit; }
.vsel-btn { display: inline-flex; align-items: center; gap: 9px; background: rgba(255,255,255,.85); border: 1px solid var(--line); border-radius: 12px; padding: 9px 15px; cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--ink); font-family: inherit; box-shadow: 0 1px 3px rgba(15,23,42,.05); }
.vsel-btn:hover { background: #fff; border-color: #cbd5e1; }
.vsel-btn svg:first-child { color: #64748b; }
.vsel-chev { color: #94a3b8; transition: transform .15s; }
.vsel.open .vsel-chev { transform: rotate(180deg); }
.vsel-menu { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); z-index: 60; background: #fff; border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 14px 36px rgba(15,23,42,.16); padding: 8px; min-width: 230px; max-height: 320px; overflow-y: auto; }
.vsel-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; border-radius: 9px; border: 0; background: transparent; font-size: 13.5px; font-weight: 500; color: var(--ink); cursor: pointer; font-family: inherit; text-align: left; }
.vsel-item:hover { background: #f1f5f9; }
.vsel-item.sel { font-weight: 700; }
.vsel-item .ck { margin-left: auto; color: var(--blue); }
.vsel-div { height: 1px; background: #eef2f7; margin: 6px 4px; }

.kvnd-card { background: rgba(255,255,255,.72); border: 1px solid rgba(255,255,255,.8); border-radius: var(--radius); padding: 20px 22px; box-shadow: var(--shadow); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.kvnd-card-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.kvnd-card-title { font-size: 14px; font-weight: 700; margin: 0; }
.kvnd-card-note { font-size: 11.5px; color: var(--ink-3); font-weight: 500; }

.kvnd-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kvnd-kpi { background: rgba(255,255,255,.72); border: 1px solid rgba(255,255,255,.8); border-radius: var(--radius-sm); padding: 18px 20px; box-shadow: var(--shadow); }
.kvnd-kpi.hero { background: linear-gradient(135deg, #4B6FE4 0%, #3EA8D8 55%, #42C9BF 100%); border: 0; }
.kvnd-kpi.orange { background: #fff7f1; border-color: #ffe2cf; }
.kvnd-kpi.hero .kvnd-kpi-label { color: rgba(255,255,255,.85); }
.kvnd-kpi.hero .kvnd-kpi-val, .kvnd-kpi.hero .kvnd-kpi-sub { color: #fff; }
.kvnd-kpi.orange .kvnd-kpi-val { color: var(--orange-d); }
.kvnd-kpi-label { font-size: 11.5px; font-weight: 600; color: var(--ink-3); margin-bottom: 9px; letter-spacing: .02em; text-transform: uppercase; }
.kvnd-kpi-val { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.kvnd-kpi-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 7px; }
.kvnd-kpi-sub .chip { font-weight: 700; padding: 1px 7px; border-radius: 999px; font-size: 11px; background: #dcfce7; color: var(--green); }

.kvnd-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.kvnd-row2 { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; }
.kvnd-row3 { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 16px; }

.kvnd-big-stat { font-size: 36px; font-weight: 800; letter-spacing: -.02em; line-height: 1; }
.kvnd-big-stat.up { color: var(--green); }
.kvnd-big-stat.down { color: var(--orange-d); }
.kvnd-donut { position: relative; width: 132px; height: 132px; margin: 4px auto 0; }
.kvnd-donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.kvnd-donut-center .big { font-size: 23px; font-weight: 800; color: var(--ink); line-height: 1; }
.kvnd-donut-center .lbl { font-size: 10px; color: var(--ink-3); margin-top: 2px; }
.kvnd-legend { display: flex; justify-content: center; gap: 16px; margin-top: 10px; font-size: 12px; color: var(--ink-2); font-weight: 600; }
.kvnd-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 6px; vertical-align: middle; }
.kvnd-meta-track { height: 13px; border-radius: 999px; background: #eef3fc; overflow: hidden; margin: 4px 0 7px; }
.kvnd-meta-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--blue), var(--cyan)); transition: width .3s; }
.kvnd-meta-fill.done { background: linear-gradient(90deg, #16a34a, #22c55e); }

.kvnd-rank { display: flex; flex-direction: column; gap: 11px; }
.kvnd-rank-row { display: flex; align-items: center; gap: 12px; }
.kvnd-rank-pos { width: 23px; height: 23px; border-radius: 7px; flex-shrink: 0; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: #eef3fc; color: var(--ink-3); }
.kvnd-rank-pos.top { background: linear-gradient(135deg, var(--blue), var(--cyan)); color: #fff; }
.kvnd-rank-body { flex: 1; min-width: 0; }
.kvnd-rank-name { font-size: 12.5px; font-weight: 600; }
.kvnd-rank-track { height: 6px; border-radius: 999px; background: #eef3fc; margin-top: 5px; overflow: hidden; }
.kvnd-rank-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--blue), var(--cyan)); }
.kvnd-rank-val { font-size: 12.5px; font-weight: 800; flex-shrink: 0; text-align: right; }

.kvnd-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.kvnd-tbl th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); font-weight: 700; padding: 0 10px 10px; border-bottom: 1px solid var(--line); }
.kvnd-tbl th.r, .kvnd-tbl td.r { text-align: right; }
.kvnd-tbl td { padding: 11px 10px; border-bottom: 1px solid var(--line); color: var(--ink-2); }
.kvnd-tbl tr:last-child td { border-bottom: 0; }
.kvnd-tbl td.name { color: var(--ink); font-weight: 600; }
.kvnd-tbl td.val { font-weight: 800; color: var(--ink); }

@media (max-width: 1100px) {
  .kvnd-kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .kvnd-row, .kvnd-row2, .kvnd-row3 { grid-template-columns: 1fr; }
}
`

const axisProps = { tick: { fontSize: 11, fill: 'var(--ink-3)', fontFamily: "'Plus Jakarta Sans', sans-serif" }, axisLine: false as const, tickLine: false as const }
const tooltipStyle = { background: 'rgba(255,255,255,.96)', border: '1px solid var(--line)', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', padding: '8px 12px', fontSize: '12.5px', fontFamily: "'Plus Jakarta Sans', sans-serif" }

/* ---------- filtro de vendedor ---------- */
function VendedorFilter({ sel, onSel }: { sel: number | null; onSel: (id: number | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const label = sel ? (VENDEDORES.find(v => v.id === sel)?.nome ?? 'Vendedor') : 'Todos os vendedores'
  return (
    <div className={`vsel ${open ? 'open' : ''}`} ref={ref}>
      <button className="vsel-btn" onClick={() => setOpen(o => !o)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 11a3 3 0 100-6 3 3 0 000 6zM16 11a2.5 2.5 0 100-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 20a6 6 0 0112 0M15 14.5a5 5 0 016 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        {label}
        <svg className="vsel-chev" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="vsel-menu">
          <button className={`vsel-item ${sel === null ? 'sel' : ''}`} onClick={() => { onSel(null); setOpen(false) }}>
            Todos os vendedores {sel === null && <svg className="ck" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>
          <div className="vsel-div" />
          {VENDEDORES.map(v => (
            <button key={v.id} className={`vsel-item ${sel === v.id ? 'sel' : ''}`} onClick={() => { onSel(v.id); setOpen(false) }}>
              {v.nome} {sel === v.id && <svg className="ck" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VendedoresPage() {
  const [vendedorSel, setVendedorSel] = useState<number | null>(null)
  const vendedor = vendedorSel ? VENDEDORES.find(v => v.id === vendedorSel) ?? null : null

  // escopo dos KPIs: equipe ou um vendedor
  const escopo = vendedor ? [vendedor] : VENDEDORES
  const fatTotal = escopo.reduce((s, v) => s + v.fat, 0)
  const notas = escopo.reduce((s, v) => s + v.notas, 0)
  const ganhos = escopo.reduce((s, v) => s + v.ganhos, 0)
  const perdidos = escopo.reduce((s, v) => s + v.perdidos, 0)
  const ticket = notas > 0 ? fatTotal / notas : 0
  const taxa = (ganhos + perdidos) > 0 ? (ganhos / (ganhos + perdidos)) * 100 : 0
  const clientes = escopo.reduce((s, v) => s + v.clientes, 0)

  // comparativo individual + sazonalidade + mix de clientes
  const mediaEquipe = VENDEDORES.reduce((s, v) => s + v.fat, 0) / VENDEDORES.length
  const pctVsMedia = vendedor ? ((vendedor.fat - mediaEquipe) / mediaEquipe) * 100 : 0
  const maxSaz = Math.max(...SAZONALIDADE.map(m => m.fat))
  const melhorMes = SAZONALIDADE.find(m => m.fat === maxSaz)?.label ?? '—'
  const recompraPct = Math.round((CLIENTES_MIX.recompra / (CLIENTES_MIX.recompra + CLIENTES_MIX.novos)) * 100)

  // rankings (exemplo: mensal embaralha um pouco a ordem do ano)
  const rankAno = [...VENDEDORES].sort((a, b) => b.fat - a.fat)
  const rankMes = [...VENDEDORES].sort((a, b) => (b.fat * (0.7 + (b.id % 3) * 0.18)) - (a.fat * (0.7 + (a.id % 3) * 0.18)))
  const maxAno = rankAno[0]?.fat ?? 1
  const maxMes = rankMes[0] ? rankMes[0].fat * (0.7 + (rankMes[0].id % 3) * 0.18) : 1
  const rankB2B = VENDEDORES.filter(v => v.cat === 'b2b').sort((a, b) => b.fat - a.fat)
  const rankB2C = VENDEDORES.filter(v => v.cat === 'b2c').sort((a, b) => b.fat - a.fat)
  const maxB2B = rankB2B[0]?.fat ?? 1
  const maxB2C = rankB2C[0]?.fat ?? 1
  // meta B2C (individual)
  const fatMesB2C = vendedor ? Math.round(vendedor.fat / 12) : 0
  const pctMeta = META_B2C > 0 ? (fatMesB2C / META_B2C) * 100 : 0

  return (
    <div className="kvnd-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppSidebar hideLogo />

      <main className="kvnd-main">
        {/* Header */}
        <div className="kvnd-topbar">
          <div className="kvnd-brand-left"><VeddaraLogo height={70} /></div>
          <h1 className="kvnd-title">Visão <em>Vendedores</em></h1>
          <p className="kvnd-sub">
            {vendedor ? `Análise individual · ${vendedor.nome}` : 'Desempenho da equipe comercial'} · <span className="kvnd-tag">dados de exemplo</span>
          </p>
        </div>

        {/* Filtros: data + vendedor */}
        <div className="kvnd-filtros">
          <DateFilter onChange={() => { /* layout — dados depois */ }} />
          <VendedorFilter sel={vendedorSel} onSel={setVendedorSel} />
        </div>

        {/* KPIs */}
        <div className="kvnd-kpi-grid">
          <div className="kvnd-kpi hero">
            <div className="kvnd-kpi-label">{vendedor ? 'Faturamento do vendedor' : 'Faturamento da equipe'}</div>
            <div className="kvnd-kpi-val">{fmtMoeda(fatTotal)}</div>
            <div className="kvnd-kpi-sub"><span className="chip">▲ 12.4%</span> vs período anterior</div>
          </div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Notas emitidas</div><div className="kvnd-kpi-val">{fmtNum(notas)}</div><div className="kvnd-kpi-sub">Documentos no período</div></div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Ticket médio</div><div className="kvnd-kpi-val">{fmtMoeda(ticket)}</div><div className="kvnd-kpi-sub">Por nota fiscal</div></div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Pipeline em aberto</div><div className="kvnd-kpi-val">{fmtMoeda(vendedor ? 78_000 : 313_000)}</div><div className="kvnd-kpi-sub">Orçamentos aguardando</div></div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Taxa de conversão</div><div className="kvnd-kpi-val">{taxa.toFixed(1)}%</div><div className="kvnd-kpi-sub">Orçamentos ganhos vs perdidos</div></div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Orçamentos ganhos</div><div className="kvnd-kpi-val" style={{ color: 'var(--blue)' }}>{fmtNum(ganhos)}</div><div className="kvnd-kpi-sub">Convertidos em pedido</div></div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">{vendedor ? 'Clientes atendidos' : 'Vendedores ativos'}</div><div className="kvnd-kpi-val">{vendedor ? fmtNum(clientes) : VENDEDORES.length}</div><div className="kvnd-kpi-sub">{vendedor ? 'No período' : 'Com vendas no período'}</div></div>
          <div className="kvnd-kpi orange"><div className="kvnd-kpi-label">Orçamentos perdidos</div><div className="kvnd-kpi-val">{fmtNum(perdidos)}</div><div className="kvnd-kpi-sub">Cancelados / expirados</div></div>
        </div>

        {!vendedor ? (
          /* ===== VISÃO DA EQUIPE ===== */
          <>
            <div className="kvnd-row">
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Ranking de vendedores — Ano</h3><span className="kvnd-card-note">Por faturamento (2026)</span></div>
                <div className="kvnd-rank">
                  {rankAno.map((v, i) => (
                    <div className="kvnd-rank-row" key={v.id}>
                      <div className={`kvnd-rank-pos ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                      <div className="kvnd-rank-body"><div className="kvnd-rank-name">{v.nome}</div><div className="kvnd-rank-track"><div className="kvnd-rank-fill" style={{ width: `${(v.fat / maxAno) * 100}%` }} /></div></div>
                      <div className="kvnd-rank-val">{fmtMoeda(v.fat)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Ranking de vendedores — Mês</h3><span className="kvnd-card-note">Por faturamento (mês atual)</span></div>
                <div className="kvnd-rank">
                  {rankMes.map((v, i) => {
                    const fatMes = v.fat * (0.7 + (v.id % 3) * 0.18)
                    return (
                      <div className="kvnd-rank-row" key={v.id}>
                        <div className={`kvnd-rank-pos ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                        <div className="kvnd-rank-body"><div className="kvnd-rank-name">{v.nome}</div><div className="kvnd-rank-track"><div className="kvnd-rank-fill" style={{ width: `${(fatMes / maxMes) * 100}%` }} /></div></div>
                        <div className="kvnd-rank-val">{fmtMoeda(fatMes)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="kvnd-row">
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Ranking B2B</h3><span className="kvnd-card-note">Por faturamento</span></div>
                <div className="kvnd-rank">
                  {rankB2B.map((v, i) => (
                    <div className="kvnd-rank-row" key={v.id}>
                      <div className={`kvnd-rank-pos ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                      <div className="kvnd-rank-body"><div className="kvnd-rank-name">{v.nome}</div><div className="kvnd-rank-track"><div className="kvnd-rank-fill" style={{ width: `${(v.fat / maxB2B) * 100}%` }} /></div></div>
                      <div className="kvnd-rank-val">{fmtMoeda(v.fat)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Ranking B2C</h3><span className="kvnd-card-note">Por faturamento · meta R$ 20k/mês</span></div>
                <div className="kvnd-rank">
                  {rankB2C.map((v, i) => (
                    <div className="kvnd-rank-row" key={v.id}>
                      <div className={`kvnd-rank-pos ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                      <div className="kvnd-rank-body"><div className="kvnd-rank-name">{v.nome}</div><div className="kvnd-rank-track"><div className="kvnd-rank-fill" style={{ width: `${(v.fat / maxB2C) * 100}%` }} /></div></div>
                      <div className="kvnd-rank-val">{fmtMoeda(v.fat)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="kvnd-card">
              <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Vendas: B2B × B2C × Sem representante</h3><span className="kvnd-card-note">Faturamento mensal por canal</span></div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={MODALIDADE} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tickFormatter={fmtAxis} {...axisProps} width={42} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtMoedaFull(Number(v)), n === 'b2b' ? 'B2B' : n === 'b2c' ? 'B2C' : 'Sem representante']} />
                  <Legend formatter={v => v === 'b2b' ? 'B2B' : v === 'b2c' ? 'B2C' : 'Sem representante'} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="b2b" stroke="#2563EB" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="b2c" stroke="#22C3DD" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="semVend" stroke="#F97316" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          /* ===== VISÃO INDIVIDUAL ===== */
          <>
            {vendedor.cat === 'b2c' && (
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Meta do mês — B2C</h3><span className="kvnd-card-note">Meta: {fmtMoedaFull(META_B2C)} / mês</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div className={`kvnd-big-stat ${pctMeta >= 100 ? 'up' : 'down'}`}>{pctMeta.toFixed(0)}%</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kvnd-meta-track"><div className={`kvnd-meta-fill ${pctMeta >= 100 ? 'done' : ''}`} style={{ width: `${Math.min(pctMeta, 100)}%` }} /></div>
                    <div className="kvnd-kpi-sub">{fmtMoedaFull(fatMesB2C)} de {fmtMoedaFull(META_B2C)} {pctMeta >= 100 ? '· meta batida ✅' : `· faltam ${fmtMoedaFull(Math.max(META_B2C - fatMesB2C, 0))}`}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="kvnd-row3">
              {/* vs média da equipe */}
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Vs. média da equipe</h3></div>
                <div className={`kvnd-big-stat ${pctVsMedia >= 0 ? 'up' : 'down'}`}>{pctVsMedia >= 0 ? '+' : ''}{pctVsMedia.toFixed(0)}%</div>
                <div className="kvnd-kpi-sub" style={{ marginTop: 9 }}>{pctVsMedia >= 0 ? 'acima' : 'abaixo'} da média da equipe</div>
                <div className="kvnd-kpi-sub">Vendedor {fmtMoeda(vendedor.fat)} · média {fmtMoeda(mediaEquipe)}</div>
              </div>

              {/* clientes novos x recompra */}
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Clientes: novos × recompra</h3></div>
                <div className="kvnd-donut">
                  <ResponsiveContainer width={132} height={132}>
                    <PieChart>
                      <Pie data={[{ name: 'Recompra', value: CLIENTES_MIX.recompra }, { name: 'Novos', value: CLIENTES_MIX.novos }]} dataKey="value" innerRadius={45} outerRadius={63} startAngle={90} endAngle={-270} stroke="none" paddingAngle={1}>
                        <Cell fill="#2563EB" />
                        <Cell fill="#F97316" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="kvnd-donut-center"><div className="big">{recompraPct}%</div><div className="lbl">recompra</div></div>
                </div>
                <div className="kvnd-legend">
                  <span><i style={{ background: '#2563EB' }} />Recompra {CLIENTES_MIX.recompra}</span>
                  <span><i style={{ background: '#F97316' }} />Novos {CLIENTES_MIX.novos}</span>
                </div>
              </div>

              {/* sazonalidade */}
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Sazonalidade</h3><span className="kvnd-card-note">Melhor mês: <strong>{melhorMes}</strong></span></div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={SAZONALIDADE} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" {...axisProps} interval={1} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtMoedaFull(Number(v)), 'Faturamento']} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
                    <Bar dataKey="fat" radius={[4, 4, 0, 0]} maxBarSize={16}>
                      {SAZONALIDADE.map((m, i) => <Cell key={i} fill={m.fat === maxSaz ? '#F97316' : '#3b6fe4'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="kvnd-row2">
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Top vendas no período</h3><span className="kvnd-card-note">{vendedor.nome}</span></div>
                <table className="kvnd-tbl">
                  <thead><tr><th>Cliente</th><th>Data</th><th className="r">Valor</th></tr></thead>
                  <tbody>
                    {TOP_VENDAS.map((t, i) => (
                      <tr key={i}><td className="name">{t.cliente}</td><td>{t.data}</td><td className="r val">{fmtMoedaFull(t.valor)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="kvnd-card">
                <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Top produtos vendidos</h3><span className="kvnd-card-note">No período</span></div>
                <table className="kvnd-tbl">
                  <thead><tr><th>Produto</th><th className="r">Qtde</th><th className="r">Faturamento</th></tr></thead>
                  <tbody>
                    {TOP_PRODUTOS.map((p, i) => (
                      <tr key={i}><td className="name">{p.produto}</td><td className="r">{fmtNum(p.qtd)}</td><td className="r val">{fmtMoeda(p.fat)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="kvnd-card">
              <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Evolução de {vendedor.nome} na Veddara</h3><span className="kvnd-card-note">Faturamento por ano (toda a história)</span></div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={EVOLUCAO_HIST} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <defs><linearGradient id="kvnd-hist" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} /><stop offset="100%" stopColor="#22C3DD" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="ano" {...axisProps} />
                  <YAxis tickFormatter={fmtAxis} {...axisProps} width={42} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtMoedaFull(Number(v)), 'Faturamento']} />
                  <Area type="monotone" dataKey="faturamento" stroke="#2563EB" strokeWidth={2.5} fill="url(#kvnd-hist)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
