'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend,
} from 'recharts'
import { AppSidebar, VeddaraLogo } from '@/components/AppSidebar'
import { DateFilter } from '@/components/DateFilter'
import type { DadosVendedores, CatVend } from '@/app/api/vendedores/route'

/* ---------- helpers ---------- */
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
function fmtMoedaFull(v: number): string { return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` }
function fmtNum(v: number): string { return v.toLocaleString('pt-BR') }
function nomeMes(anomes: string): string {
  const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const ano = anomes.slice(0, 4); const mes = parseInt(anomes.slice(4), 10)
  return `${m[mes - 1]}/${ano.slice(2)}`
}
const CAT_LABEL: Record<CatVend, string> = { b2b: 'B2B', b2c: 'B2C', sem: 'Sem representante' }

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
.kvnd-filtros { display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; }

.vsel { position: relative; font-family: inherit; }
.vsel-btn { display: inline-flex; align-items: center; gap: 9px; background: rgba(255,255,255,.85); border: 1px solid var(--line); border-radius: 12px; padding: 9px 15px; cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--ink); font-family: inherit; box-shadow: 0 1px 3px rgba(15,23,42,.05); }
.vsel-btn:hover { background: #fff; border-color: #cbd5e1; }
.vsel-btn svg:first-child { color: #64748b; }
.vsel-chev { color: #94a3b8; transition: transform .15s; }
.vsel.open .vsel-chev { transform: rotate(180deg); }
.vsel-menu { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); z-index: 60; background: #fff; border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 14px 36px rgba(15,23,42,.16); padding: 8px; min-width: 240px; max-height: 340px; overflow-y: auto; }
.vsel-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; border-radius: 9px; border: 0; background: transparent; font-size: 13.5px; font-weight: 500; color: var(--ink); cursor: pointer; font-family: inherit; text-align: left; }
.vsel-item:hover { background: #f1f5f9; }
.vsel-item.sel { font-weight: 700; }
.vsel-item .ck { margin-left: auto; color: var(--blue); }
.vsel-cat { font-size: 10px; font-weight: 700; color: var(--ink-3); padding: 1px 6px; border-radius: 6px; background: #eef3fc; margin-left: 6px; }
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

.kvnd-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.kvnd-rank { display: flex; flex-direction: column; gap: 11px; }
.kvnd-rank-row { display: flex; align-items: center; gap: 12px; }
.kvnd-rank-pos { width: 23px; height: 23px; border-radius: 7px; flex-shrink: 0; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: #eef3fc; color: var(--ink-3); }
.kvnd-rank-pos.top { background: linear-gradient(135deg, var(--blue), var(--cyan)); color: #fff; }
.kvnd-rank-body { flex: 1; min-width: 0; }
.kvnd-rank-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kvnd-rank-track { height: 6px; border-radius: 999px; background: #eef3fc; margin-top: 5px; overflow: hidden; }
.kvnd-rank-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--blue), var(--cyan)); }
.kvnd-rank-val { font-size: 12.5px; font-weight: 800; flex-shrink: 0; text-align: right; }

.kvnd-empty { padding: 36px 16px; text-align: center; font-size: 13px; color: var(--ink-3); line-height: 1.6; }
.kvnd-sk { border-radius: 12px; background: #eef3fc; animation: kvnd-pulse 1.4s ease-in-out infinite; }
@keyframes kvnd-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
.kvnd-soon { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--orange-d); background: #fff1e7; padding: 3px 9px; border-radius: 999px; }

@media (max-width: 1100px) { .kvnd-kpi-grid { grid-template-columns: repeat(2, 1fr); } .kvnd-row { grid-template-columns: 1fr; } }
`
const axisProps = { tick: { fontSize: 11, fill: 'var(--ink-3)', fontFamily: "'Plus Jakarta Sans', sans-serif" }, axisLine: false as const, tickLine: false as const }
const tooltipStyle = { background: 'rgba(255,255,255,.96)', border: '1px solid var(--line)', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', padding: '8px 12px', fontSize: '12.5px', fontFamily: "'Plus Jakarta Sans', sans-serif" }

type Vend = DadosVendedores['vendedores'][number]

function VendedorFilter({ lista, sel, onSel }: { lista: Vend[]; sel: string | null; onSel: (n: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div className={`vsel ${open ? 'open' : ''}`} ref={ref}>
      <button className="vsel-btn" onClick={() => setOpen(o => !o)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 11a3 3 0 100-6 3 3 0 000 6zM16 11a2.5 2.5 0 100-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 20a6 6 0 0112 0M15 14.5a5 5 0 016 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        {sel ?? 'Todos os vendedores'}
        <svg className="vsel-chev" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="vsel-menu">
          <button className={`vsel-item ${sel === null ? 'sel' : ''}`} onClick={() => { onSel(null); setOpen(false) }}>Todos os vendedores</button>
          <div className="vsel-div" />
          {lista.map(v => (
            <button key={v.nome} className={`vsel-item ${sel === v.nome ? 'sel' : ''}`} onClick={() => { onSel(v.nome); setOpen(false) }}>
              {v.nome} <span className="vsel-cat">{CAT_LABEL[v.cat]}</span>
              {sel === v.nome && <svg className="ck" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VendedoresPage() {
  const router = useRouter()
  const [dados, setDados] = useState<DadosVendedores | null>(null)
  const [erro, setErro] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [sel, setSel] = useState<string | null>(null)

  const carregar = useCallback((ini: string, f: string) => {
    setDados(null); setErro('')
    const p = new URLSearchParams()
    if (ini && f) { p.set('inicio', ini); p.set('fim', f) }
    const qs = p.toString()
    fetch(`/api/vendedores${qs ? '?' + qs : ''}`)
      .then(res => { if (res.status === 401) { router.push('/login'); return null } return res.json() })
      .then(d => { if (!d) return; if (d.error) { setErro(String(d.error)); return } setDados(d as DadosVendedores) })
      .catch(e => setErro(String(e)))
  }, [router])
  useEffect(() => { carregar('', '') }, [carregar])
  function aplicarData(ini: string, f: string) { setInicio(ini); setFim(f); carregar(ini, f) }

  const vendedores = dados?.vendedores ?? []
  const vendedor = sel ? vendedores.find(v => v.nome === sel) ?? null : null
  const escopo = vendedor ? [vendedor] : vendedores
  const fatTotal = escopo.reduce((s, v) => s + v.fat, 0)
  const notas = escopo.reduce((s, v) => s + v.notas, 0)
  const ganhos = escopo.reduce((s, v) => s + v.ganhos, 0)
  const perdidos = escopo.reduce((s, v) => s + v.perdidos, 0)
  const clientes = escopo.reduce((s, v) => s + v.clientes, 0)
  const ticket = notas > 0 ? fatTotal / notas : 0
  const taxa = (ganhos + perdidos) > 0 ? (ganhos / (ganhos + perdidos)) * 100 : 0
  const maior = [...vendedores].sort((a, b) => b.fat - a.fat)[0]

  const rankAno = dados?.rankAno ?? []
  const rankMes = dados?.rankMes ?? []
  const rankB2B = [...vendedores].filter(v => v.cat === 'b2b').sort((a, b) => b.fat - a.fat)
  const rankB2C = [...vendedores].filter(v => v.cat === 'b2c').sort((a, b) => b.fat - a.fat)
  const mensal = (dados?.mensalCanal ?? []).map(m => ({ label: nomeMes(m.anomes), b2b: m.b2b, b2c: m.b2c, sem: m.sem }))

  function Ranking({ titulo, nota, itens, max }: { titulo: string; nota: string; itens: Array<{ nome: string; fat: number }>; max: number }) {
    return (
      <div className="kvnd-card">
        <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">{titulo}</h3><span className="kvnd-card-note">{nota}</span></div>
        {itens.length === 0 ? <div className="kvnd-empty">Sem dados no período</div> : (
          <div className="kvnd-rank">
            {itens.map((v, i) => (
              <div className="kvnd-rank-row" key={v.nome}>
                <div className={`kvnd-rank-pos ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                <div className="kvnd-rank-body"><div className="kvnd-rank-name">{v.nome}</div><div className="kvnd-rank-track"><div className="kvnd-rank-fill" style={{ width: `${(v.fat / (max || 1)) * 100}%` }} /></div></div>
                <div className="kvnd-rank-val">{fmtMoeda(v.fat)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="kvnd-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppSidebar hideLogo />
      <main className="kvnd-main">
        <div className="kvnd-topbar">
          <div className="kvnd-brand-left"><VeddaraLogo height={70} /></div>
          <h1 className="kvnd-title">Visão <em>Vendedores</em></h1>
          <p className="kvnd-sub">{vendedor ? `Análise individual · ${vendedor.nome}` : 'Desempenho da equipe comercial'} · dados reais Sybase IQ</p>
        </div>

        <div className="kvnd-filtros">
          <DateFilter onChange={aplicarData} />
          <VendedorFilter lista={vendedores} sel={sel} onSel={setSel} />
        </div>

        {erro && <div className="kvnd-card" style={{ color: '#dc2626', fontSize: 13 }}>Erro ao carregar dados: {erro}</div>}

        {/* KPIs */}
        <div className="kvnd-kpi-grid">
          <div className="kvnd-kpi hero"><div className="kvnd-kpi-label">{vendedor ? 'Faturamento do vendedor' : 'Faturamento da equipe'}</div>{dados ? <><div className="kvnd-kpi-val">{fmtMoeda(fatTotal)}</div><div className="kvnd-kpi-sub">{vendedor ? CAT_LABEL[vendedor.cat] : `${vendedores.length} vendedores`}</div></> : <div className="kvnd-sk" style={{ height: 40 }} />}</div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Notas emitidas</div>{dados ? <><div className="kvnd-kpi-val">{fmtNum(notas)}</div><div className="kvnd-kpi-sub">Documentos no período</div></> : <div className="kvnd-sk" style={{ height: 40 }} />}</div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Ticket médio</div>{dados ? <><div className="kvnd-kpi-val">{fmtMoeda(ticket)}</div><div className="kvnd-kpi-sub">Por nota fiscal</div></> : <div className="kvnd-sk" style={{ height: 40 }} />}</div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">{vendedor ? 'Clientes atendidos' : 'Maior vendedor'}</div>{dados ? <>{vendedor ? <><div className="kvnd-kpi-val">{fmtNum(clientes)}</div><div className="kvnd-kpi-sub">No período</div></> : <><div className="kvnd-kpi-val" style={{ fontSize: 17 }}>{maior?.nome ?? '—'}</div><div className="kvnd-kpi-sub">{maior ? fmtMoeda(maior.fat) : ''}</div></>}</> : <div className="kvnd-sk" style={{ height: 40 }} />}</div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Taxa de conversão</div>{dados ? <><div className="kvnd-kpi-val">{taxa.toFixed(1)}%</div><div className="kvnd-kpi-sub">Orçamentos ganhos vs perdidos</div></> : <div className="kvnd-sk" style={{ height: 40 }} />}</div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">Orçamentos ganhos</div>{dados ? <><div className="kvnd-kpi-val" style={{ color: 'var(--blue)' }}>{fmtNum(ganhos)}</div><div className="kvnd-kpi-sub">Convertidos em pedido</div></> : <div className="kvnd-sk" style={{ height: 40 }} />}</div>
          <div className="kvnd-kpi"><div className="kvnd-kpi-label">{vendedor ? 'Clientes' : 'Vendedores ativos'}</div>{dados ? <><div className="kvnd-kpi-val">{vendedor ? fmtNum(clientes) : vendedores.length}</div><div className="kvnd-kpi-sub">{vendedor ? 'Atendidos' : 'Com vendas no período'}</div></> : <div className="kvnd-sk" style={{ height: 40 }} />}</div>
          <div className="kvnd-kpi orange"><div className="kvnd-kpi-label">Orçamentos perdidos</div>{dados ? <><div className="kvnd-kpi-val">{fmtNum(perdidos)}</div><div className="kvnd-kpi-sub">Cancelados / expirados</div></> : <div className="kvnd-sk" style={{ height: 40 }} />}</div>
        </div>

        {!vendedor ? (
          /* ===== EQUIPE (real) ===== */
          <>
            <div className="kvnd-row">
              <Ranking titulo="Ranking — Ano" nota={`Faturamento (${new Date().getFullYear()})`} itens={rankAno} max={rankAno[0]?.fat ?? 1} />
              <Ranking titulo="Ranking — Mês" nota="Faturamento (mês atual)" itens={rankMes} max={rankMes[0]?.fat ?? 1} />
            </div>
            <div className="kvnd-row">
              <Ranking titulo="Ranking B2B" nota="Por faturamento" itens={rankB2B} max={rankB2B[0]?.fat ?? 1} />
              <Ranking titulo="Ranking B2C" nota="Por faturamento · meta R$ 20k/mês" itens={rankB2C} max={rankB2C[0]?.fat ?? 1} />
            </div>
            <div className="kvnd-card">
              <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Vendas: B2B × B2C × Sem representante</h3><span className="kvnd-card-note">Faturamento mensal por canal</span></div>
              {!dados ? <div className="kvnd-sk" style={{ height: 300 }} /> : mensal.length === 0 ? <div className="kvnd-empty" style={{ height: 300, display: 'grid', placeItems: 'center' }}>Sem dados no período</div> : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mensal} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tickFormatter={fmtAxis} {...axisProps} width={42} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtMoedaFull(Number(v)), n === 'b2b' ? 'B2B' : n === 'b2c' ? 'B2C' : 'Sem representante']} />
                    <Legend formatter={v => v === 'b2b' ? 'B2B' : v === 'b2c' ? 'B2C' : 'Sem representante'} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="b2b" stroke="#2563EB" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="b2c" stroke="#22C3DD" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="sem" stroke="#F97316" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        ) : (
          /* ===== INDIVIDUAL ===== */
          <div className="kvnd-card">
            <div className="kvnd-card-hdr"><h3 className="kvnd-card-title">Detalhamento de {vendedor.nome}</h3><span className="kvnd-soon">em construção</span></div>
            <div className="kvnd-empty">
              Os KPIs acima já são reais. O detalhamento individual<br />
              (top vendas, top produtos, evolução na Veddara, sazonalidade, clientes novos × recompra{vendedor.cat === 'b2c' ? ', metas B2C' : ''})<br />
              entra na próxima etapa — preciso montar e validar as queries por vendedor.
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
