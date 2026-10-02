'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppSidebar, VeddaraLogo } from '@/components/AppSidebar'
import type { ControleItem } from '@/app/api/controle/route'

function fmtNum(v: number): string { return v.toLocaleString('pt-BR') }

// dd/mm/aa a partir de um ISO (ou '—' se vazio/ inválido)
function fmtData(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const aa = String(d.getFullYear()).slice(2)
  return `${dd}/${mm}/${aa}`
}

const CRIT_LABEL: Record<'critico' | 'atencao' | 'ok', string> = { critico: 'Crítico', atencao: 'Atenção', ok: 'OK' }

// Rastreio novo válido: MIE<dígitos> (Mile) ou TR<dígitos>BR (TriStar)
function rastreioValido(v: string): boolean {
  const up = v.trim().toUpperCase()
  return /^MIE\d+$/.test(up) || /^TR\d+BR$/.test(up)
}

interface PreviewRastreio {
  invoice: string
  cliente: string
  rastreio_atual: string
  ja_substituido: boolean
  rastreio_novo: string
  transportadora_nova: string
}

// Baixa a tabela (respeitando os filtros aplicados) como CSV — abre direto no Excel.
function baixarControle(linhas: ControleItem[]) {
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const headers = ['Transportadora', 'Rastreio', 'Invoice', 'Cliente', 'Telefone', 'Data envio', 'Etapa', 'Última movimentação', 'Dias desde envio', 'Dias parado', 'Criticidade']
  const rows = linhas.map(i => [
    i.transportadora, i.rastreio, i.invoice, i.cliente, i.telefone,
    fmtData(i.dataEnvio), i.etapa, fmtData(i.ultimaMovimentacao),
    i.diasDesdeEnvio, i.diasParado, CRIT_LABEL[i.criticidade],
  ])
  const csv = '﻿' + [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `entregas-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Faixa-resumo (funil): etapa_num → rótulo, na ordem de exibição pedida.
// etapa_num 0 = "Sem rastreio" (registrada na transportadora, sem evento ainda).
const ETAPAS: Array<{ num: number; label: string; alerta?: boolean }> = [
  { num: 1, label: 'Criado' },
  { num: 2, label: 'Processado no armazém' },
  { num: 3, label: 'Trânsito internacional' },
  { num: 4, label: 'Alfândega/ANVISA' },
  { num: 5, label: 'Base/transferência' },
  { num: 6, label: 'Em rota de entrega' },
  { num: 7, label: 'Ocorrência', alerta: true },
  { num: 0, label: 'Sem rastreio' },
]

const CSS = `
.kctl-root, .kctl-root * { box-sizing: border-box; }
.kctl-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  display: grid; grid-template-columns: 150px 1fr; min-height: 100vh;
  background: linear-gradient(135deg, #eaf1fc 0%, #f2f6fc 45%, #fdeee7 100%); background-attachment: fixed;
  color: #1e293b;
  --blue: #2563EB; --cyan: #22C3DD; --danger: #e11d48; --warn: #ea580c; --ok: #16a34a;
  --line: #e8edf3; --ink-3: #94a3b8;
}
.kctl-main { padding: 20px 26px 44px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }

.kctl-top { display: flex; align-items: center; justify-content: center; position: relative; min-height: 46px; }
.kctl-brand { position: absolute; left: 0; top: 50%; transform: translateY(-50%); }
.kctl-title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 34px; letter-spacing: -0.01em; margin: 0; text-align: center; }
.kctl-title em { font-style: normal; background: linear-gradient(90deg, var(--blue), var(--cyan)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.kctl-right { position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 12px; }
.kctl-refresh { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: #fff; color: #64748b; display: grid; place-items: center; cursor: pointer; }
.kctl-refresh:hover { background: #f8fafc; color: #1e293b; }
.kctl-refresh:active { transform: scale(.93); }

.kctl-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.kctl-kpi { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 16px 18px; box-shadow: 0 6px 22px rgba(15,23,42,.05); }
.kctl-kpi-lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
.kctl-kpi-val { font-size: 27px; font-weight: 800; margin-top: 4px; letter-spacing: -.02em; }
.kctl-kpi.crit { background: #fef2f2; border-color: #fecaca; }
.kctl-kpi.crit .kctl-kpi-lbl, .kctl-kpi.crit .kctl-kpi-val { color: var(--danger); }
.kctl-kpi.aten { background: #fff7ed; border-color: #fed7aa; }
.kctl-kpi.aten .kctl-kpi-lbl, .kctl-kpi.aten .kctl-kpi-val { color: var(--warn); }

/* Funil de etapas */
.kctl-funnel { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; }
@media (max-width: 1100px) { .kctl-funnel { grid-template-columns: repeat(4, 1fr); } }
.kctl-stage { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 12px 13px; box-shadow: 0 4px 16px rgba(15,23,42,.04); display: flex; flex-direction: column; gap: 6px; min-height: 84px; cursor: pointer; transition: border-color .12s, box-shadow .12s, transform .08s; text-align: left; }
.kctl-stage:hover { border-color: #bfdbfe; box-shadow: 0 6px 20px rgba(37,99,235,.12); }
.kctl-stage:active { transform: scale(.98); }
.kctl-stage-n { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1e293b; line-height: 1; }
.kctl-stage-l { font-size: 11px; font-weight: 600; color: #64748b; line-height: 1.25; }
.kctl-stage.alerta { background: #fff7ed; border-color: #fed7aa; }
.kctl-stage.alerta .kctl-stage-n { color: var(--warn); }
.kctl-stage.alerta .kctl-stage-l { color: #b45309; }
.kctl-stage.ativa { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(37,99,235,.25); }

.kctl-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.kctl-search { flex: 1; min-width: 220px; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 9px 14px; font-size: 13.5px; font-family: inherit; color: #1e293b; outline: none; }
.kctl-search:focus { border-color: var(--blue); }
.kctl-select { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 13.5px; font-weight: 600; font-family: inherit; color: #1e293b; outline: none; cursor: pointer; }
.kctl-select:focus { border-color: var(--blue); }

.kctl-tablewrap { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: auto; box-shadow: 0 6px 22px rgba(15,23,42,.05); }
.kctl-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 980px; }
.kctl-table thead th { background: #f8fafc; color: #64748b; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 11px 12px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--line); }
.kctl-table thead th.r { text-align: right; }
.kctl-table thead th.c { text-align: center; }
.kctl-table thead th.sort { cursor: pointer; user-select: none; }
.kctl-table thead th.sort:hover { color: #1e293b; }
.kctl-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: left; color: #475569; }
.kctl-table td.r { text-align: right; font-variant-numeric: tabular-nums; }
.kctl-table td.c { text-align: center; }
.kctl-table tr:last-child td { border-bottom: 0; }
.kctl-table td.cli { color: #1e293b; font-weight: 600; max-width: 240px; }
.kctl-table td.mono { font-variant-numeric: tabular-nums; color: #334155; }
.kctl-table tbody tr:hover td { background: #f8fbff; }
.kctl-table tr.crit td { background: #fff5f5; }
.kctl-table tr.crit:hover td { background: #ffecec; }
.kctl-dias-crit { color: var(--danger); font-weight: 800; }
.kctl-dias-aten { color: var(--warn); font-weight: 700; }

.kctl-tr { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 800; letter-spacing: .02em; }
.kctl-tr.mile { background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; }
.kctl-tr.tristar { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.kctl-crit { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
.kctl-crit.critico { background: #fef2f2; color: var(--danger); }
.kctl-crit.atencao { background: #fff7ed; color: var(--warn); }
.kctl-crit.ok { background: #ecfdf5; color: var(--ok); }

.kctl-empty { padding: 40px; text-align: center; color: var(--ink-3); font-size: 13.5px; }
.kctl-sk { height: 300px; border-radius: 16px; background: linear-gradient(90deg,#f1f5f9,#f8fafc,#f1f5f9); background-size: 200% 100%; animation: kctlpulse 1.3s ease-in-out infinite; }
@keyframes kctlpulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* Badge de rastreio substituído */
.kctl-sub { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; vertical-align: middle; cursor: help; }
.kctl-sub-old { font-size: 10px; color: #94a3b8; margin-top: 2px; }

/* Botão "Substituir rastreio" no topo */
.kctl-sub-btn { display: flex; align-items: center; gap: 7px; padding: 9px 15px; border-radius: 10px; border: 1px solid var(--blue); background: var(--blue); color: #fff; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700; }
.kctl-sub-btn:hover { filter: brightness(1.05); }

/* Banner de sucesso */
.kctl-ok-banner { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 13px; padding: 10px 14px; border-radius: 12px; }

/* Modal */
.kctl-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: grid; place-items: center; z-index: 500; padding: 20px; }
.kctl-modal { background: #fff; border-radius: 18px; width: 100%; max-width: 470px; padding: 22px 22px 20px; box-shadow: 0 20px 60px rgba(15,23,42,.3); }
.kctl-modal h2 { font-size: 18px; font-weight: 800; margin: 0 0 4px; }
.kctl-modal .sub { font-size: 12.5px; color: #64748b; margin-bottom: 16px; }
.kctl-field { margin-bottom: 12px; }
.kctl-field label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 5px; }
.kctl-field .hint { font-weight: 500; color: #94a3b8; font-size: 11px; }
.kctl-input { width: 100%; padding: 10px 12px; border: 1px solid #dbe2ea; border-radius: 10px; font-size: 13.5px; font-family: inherit; color: #1e293b; outline: none; }
.kctl-input:focus { border-color: var(--blue); }
.kctl-input.mono { font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.kctl-modal-err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-size: 12.5px; padding: 9px 12px; border-radius: 9px; margin-bottom: 12px; }
.kctl-preview { background: #f8fafc; border: 1px solid var(--line); border-radius: 12px; padding: 14px; font-size: 13px; color: #334155; margin-bottom: 14px; line-height: 1.55; }
.kctl-preview b { color: #1e293b; }
.kctl-warn-ja { background: #fff7ed; color: #b45309; border: 1px solid #fed7aa; font-size: 12px; padding: 8px 10px; border-radius: 9px; margin-top: 10px; }
.kctl-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px; }
.kctl-btn { padding: 10px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; }
.kctl-btn.ghost { background: #fff; border-color: var(--line); color: #64748b; }
.kctl-btn.ghost:hover { background: #f8fafc; }
.kctl-btn.primary { background: var(--blue); color: #fff; }
.kctl-btn.ok { background: var(--ok); color: #fff; }
.kctl-btn.primary:hover, .kctl-btn.ok:hover { filter: brightness(1.05); }
.kctl-btn:disabled { opacity: .5; cursor: not-allowed; }
`

type SortCampo = 'diasDesdeEnvio' | 'diasParado' | null

export default function ControlePage() {
  const router = useRouter()
  const [itens, setItens] = useState<ControleItem[] | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [transp, setTransp] = useState<'' | 'MILE' | 'TRISTAR'>('')
  const [crit, setCrit] = useState<'' | ControleItem['criticidade']>('')
  const [etapa, setEtapa] = useState<number | null>(null)
  const [sort, setSort] = useState<{ campo: SortCampo; dir: 'asc' | 'desc' }>({ campo: null, dir: 'desc' })
  const [sucesso, setSucesso] = useState('')

  // Modal "Substituir rastreio"
  const [modalAberto, setModalAberto] = useState(false)
  const [fBusca, setFBusca] = useState('')
  const [fRastreio, setFRastreio] = useState('')
  const [fMotivo, setFMotivo] = useState('')
  const [preview, setPreview] = useState<PreviewRastreio | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [modalErro, setModalErro] = useState('')

  const carregar = useCallback(() => {
    setErro('')
    fetch('/api/controle')
      .then(res => { if (res.status === 401) { router.push('/login'); return null } return res.json() })
      .then(d => { if (!d) return; if (d.error) { setErro(String(d.error)); setItens([]); return } setItens(d.itens as ControleItem[]) })
      .catch(e => { setErro(String(e)); setItens([]) })
  }, [router])
  useEffect(() => { carregar() }, [carregar])

  function abrirModal() {
    setFBusca(''); setFRastreio(''); setFMotivo(''); setPreview(null); setModalErro(''); setEnviando(false); setModalAberto(true)
  }
  function fecharModal() { setModalAberto(false); setEnviando(false) }

  // Passo 1 (confirmar=false): dry-run → mostra o preview. Passo 2 (confirmar=true): aplica.
  async function enviarRastreio(confirmar: boolean) {
    setModalErro('')
    const rastreioNovo = fRastreio.trim().toUpperCase()
    if (!fBusca.trim()) { setModalErro('Informe o pedido (invoice ou rastreio antigo).'); return }
    if (!rastreioValido(rastreioNovo)) { setModalErro('Rastreio novo inválido. Use o formato MIE… (Mile) ou TR…BR (TriStar).'); return }
    setEnviando(true)
    try {
      const res = await fetch('/api/controle/rastreio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busca: fBusca.trim(), rastreio_novo: rastreioNovo, motivo: fMotivo.trim(), confirmar }),
      })
      const d = await res.json().catch(() => ({ error: `Erro ${res.status}` }))
      if (!res.ok || d.error) { setModalErro(String(d.error || `Erro ${res.status}`)); setEnviando(false); return }
      if (!confirmar) {
        setPreview((d.preview ?? null) as PreviewRastreio | null)
        setEnviando(false)
      } else {
        const inv = d.aplicado?.invoice ?? preview?.invoice ?? fBusca.trim()
        setModalAberto(false); setEnviando(false)
        setSucesso(`Rastreio do pedido ${inv} substituído com sucesso.`)
        carregar()
        setTimeout(() => setSucesso(''), 7000)
      }
    } catch (e) {
      setModalErro(e instanceof Error ? e.message : String(e)); setEnviando(false)
    }
  }

  // Contagem por etapa (para a faixa-resumo)
  const contagemEtapa = useMemo(() => {
    const m: Record<number, number> = {}
    for (const i of itens ?? []) m[i.etapaNum] = (m[i.etapaNum] ?? 0) + 1
    return m
  }, [itens])

  const totalAberto = itens?.length ?? 0
  const totalCritico = (itens ?? []).filter(i => i.criticidade === 'critico').length
  const totalAtencao = (itens ?? []).filter(i => i.criticidade === 'atencao').length

  const linhas = useMemo(() => {
    if (!itens) return []
    const q = busca.trim().toLowerCase()
    const filtradas = itens.filter(i => {
      if (transp && i.transportadora !== transp) return false
      if (crit && i.criticidade !== crit) return false
      if (etapa !== null && i.etapaNum !== etapa) return false
      if (q && !(`${i.cliente} ${i.invoice} ${i.rastreio}`.toLowerCase().includes(q))) return false
      return true
    })
    // Sem sort do usuário: mantém a ordem do backend (críticos e mais atrasados primeiro)
    if (!sort.campo) return filtradas
    const campo = sort.campo
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...filtradas].sort((a, b) => (a[campo] - b[campo]) * mul)
  }, [itens, busca, transp, crit, etapa, sort])

  function toggleSort(campo: Exclude<SortCampo, null>) {
    setSort(s => s.campo === campo ? { campo, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'desc' })
  }
  const seta = (campo: Exclude<SortCampo, null>) => sort.campo === campo ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <div className="kctl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppSidebar hideLogo />

      <main className="kctl-main">
        <div className="kctl-top">
          <div className="kctl-brand"><VeddaraLogo height={70} /></div>
          <h1 className="kctl-title"><em>Controle Rastreio</em></h1>
          <div className="kctl-right">
            <button className="kctl-sub-btn" onClick={abrirModal} title="Substituir o rastreio de um pedido">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Substituir rastreio
            </button>
            <button className="kctl-refresh" title="Atualizar" aria-label="Atualizar" onClick={carregar}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        {erro && <div className="kctl-tablewrap" style={{ padding: 16, color: '#dc2626', fontSize: 13 }}>Erro ao carregar o controle de rastreio: {erro}</div>}
        {sucesso && <div className="kctl-ok-banner">✅ {sucesso}</div>}

        {/* KPIs */}
        <div className="kctl-kpis">
          <div className="kctl-kpi"><div className="kctl-kpi-lbl">Total em aberto</div><div className="kctl-kpi-val">{fmtNum(totalAberto)}</div></div>
          <div className="kctl-kpi crit"><div className="kctl-kpi-lbl">Críticas</div><div className="kctl-kpi-val">{fmtNum(totalCritico)}</div></div>
          <div className="kctl-kpi aten"><div className="kctl-kpi-lbl">Atenção</div><div className="kctl-kpi-val">{fmtNum(totalAtencao)}</div></div>
        </div>

        {/* Faixa-resumo (funil por etapa) — clicar filtra por aquela etapa */}
        <div className="kctl-funnel">
          {ETAPAS.map(e => (
            <button
              key={e.num}
              type="button"
              className={`kctl-stage ${e.alerta ? 'alerta' : ''} ${etapa === e.num ? 'ativa' : ''}`}
              onClick={() => setEtapa(etapa === e.num ? null : e.num)}
              title={etapa === e.num ? 'Clique para remover o filtro' : `Filtrar por: ${e.label}`}
            >
              <div className="kctl-stage-n">{fmtNum(contagemEtapa[e.num] ?? 0)}</div>
              <div className="kctl-stage-l">{e.label}</div>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="kctl-filters">
          <select className="kctl-select" value={transp} onChange={e => setTransp(e.target.value as '' | 'MILE' | 'TRISTAR')}>
            <option value="">Todas as transportadoras</option>
            <option value="MILE">Mile</option>
            <option value="TRISTAR">TriStar</option>
          </select>
          <select className="kctl-select" value={crit} onChange={e => setCrit(e.target.value as '' | ControleItem['criticidade'])}>
            <option value="">Todas as criticidades</option>
            <option value="critico">Crítico</option>
            <option value="atencao">Atenção</option>
            <option value="ok">OK</option>
          </select>
          <select className="kctl-select" value={etapa === null ? '' : String(etapa)} onChange={e => setEtapa(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Todas as etapas</option>
            {ETAPAS.map(e => <option key={e.num} value={e.num}>{e.label}</option>)}
          </select>
          <input className="kctl-search" placeholder="🔍 Buscar cliente, invoice ou rastreio…" value={busca} onChange={e => setBusca(e.target.value)} />
          <button
            onClick={() => baixarControle(linhas)}
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
        {!itens ? <div className="kctl-sk" /> : (
          <div className="kctl-tablewrap">
            <table className="kctl-table">
              <thead>
                <tr>
                  <th>Transp.</th>
                  <th>Rastreio</th>
                  <th>Invoice</th>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Data envio</th>
                  <th>Etapa atual</th>
                  <th>Última mov.</th>
                  <th className="r sort" onClick={() => toggleSort('diasDesdeEnvio')}>Dias desde envio{seta('diasDesdeEnvio')}</th>
                  <th className="r sort" onClick={() => toggleSort('diasParado')}>Dias parado{seta('diasParado')}</th>
                  <th className="c">Criticidade</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((i, ix) => {
                  const cls = i.criticidade === 'critico' ? 'kctl-dias-crit' : i.criticidade === 'atencao' ? 'kctl-dias-aten' : ''
                  return (
                    <tr key={ix} className={i.criticidade === 'critico' ? 'crit' : ''}>
                      <td><span className={`kctl-tr ${i.transportadora === 'MILE' ? 'mile' : 'tristar'}`}>{i.transportadora === 'MILE' ? 'MILE' : 'TRISTAR'}</span></td>
                      <td className="mono">
                        {i.rastreio || '—'}
                        {i.rastreioSubstituido && (
                          <span className="kctl-sub" title={i.rastreioAntigo ? `Antes: ${i.rastreioAntigo}` : 'Rastreio substituído'}>substituído</span>
                        )}
                        {i.rastreioSubstituido && i.rastreioAntigo && <div className="kctl-sub-old">antes: {i.rastreioAntigo}</div>}
                      </td>
                      <td className="mono">{i.invoice || '—'}</td>
                      <td className="cli">{i.cliente || '—'}</td>
                      <td className="mono">{i.telefone || '—'}</td>
                      <td className="mono">{fmtData(i.dataEnvio)}</td>
                      <td>{i.etapa || '—'}</td>
                      <td className="mono">{fmtData(i.ultimaMovimentacao)}</td>
                      <td className="r"><span className={cls}>{fmtNum(i.diasDesdeEnvio)}</span></td>
                      <td className="r"><span className={cls}>{fmtNum(i.diasParado)}</span></td>
                      <td className="c"><span className={`kctl-crit ${i.criticidade}`}>{CRIT_LABEL[i.criticidade]}</span></td>
                    </tr>
                  )
                })}
                {linhas.length === 0 && <tr><td colSpan={11}><div className="kctl-empty">Nenhuma remessa com esses filtros.</div></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
          Remessas <b>não entregues</b> das transportadoras Mile e TriStar. <b style={{ color: '#e11d48' }}>Crítico</b> = +20 dias desde o envio ou +10 dias parado na mesma etapa · <b style={{ color: '#ea580c' }}>Atenção</b> = 15/7 dias. &quot;Sem rastreio&quot; = registrada na transportadora, ainda sem evento de rastreio.
        </div>
      </main>

      {/* Modal: substituir rastreio */}
      {modalAberto && (
        <div className="kctl-overlay" onClick={fecharModal}>
          <div className="kctl-modal" onClick={e => e.stopPropagation()}>
            <h2>Substituir rastreio</h2>
            <div className="sub">Troque o rastreio de um pedido reenviado. O sistema passa a acompanhar o novo código.</div>

            {modalErro && <div className="kctl-modal-err">{modalErro}</div>}

            {!preview ? (
              <>
                <div className="kctl-field">
                  <label>Pedido <span className="hint">— invoice (ex: 12060) ou rastreio antigo (ex: MIE4216…)</span></label>
                  <input className="kctl-input mono" value={fBusca} onChange={e => setFBusca(e.target.value)} placeholder="12060 ou MIE421677856659855" autoFocus />
                </div>
                <div className="kctl-field">
                  <label>Rastreio novo <span className="hint">— MIE… (Mile) ou TR…BR (TriStar)</span></label>
                  <input className="kctl-input mono" value={fRastreio} onChange={e => setFRastreio(e.target.value)} placeholder="TR000163033BR" />
                </div>
                <div className="kctl-field">
                  <label>Motivo <span className="hint">— opcional</span></label>
                  <input className="kctl-input" value={fMotivo} onChange={e => setFMotivo(e.target.value)} placeholder="Ex: reenvio" />
                </div>
                <div className="kctl-modal-actions">
                  <button className="kctl-btn ghost" onClick={fecharModal} disabled={enviando}>Cancelar</button>
                  <button className="kctl-btn primary" onClick={() => enviarRastreio(false)} disabled={enviando}>{enviando ? 'Verificando…' : 'Continuar'}</button>
                </div>
              </>
            ) : (
              <>
                <div className="kctl-preview">
                  Pedido <b>{preview.invoice}</b>{preview.cliente ? <> de <b>{preview.cliente}</b></> : null}:<br />
                  <b>{preview.rastreio_atual || '—'}</b> será substituído por <b>{preview.rastreio_novo}</b>
                  {preview.transportadora_nova ? <> (<b>{preview.transportadora_nova}</b>)</> : null}.
                  {preview.ja_substituido && (
                    <div className="kctl-warn-ja">⚠️ Este pedido já teve o rastreio substituído antes — esta troca passa a ser a vigente.</div>
                  )}
                </div>
                <div className="kctl-modal-actions">
                  <button className="kctl-btn ghost" onClick={() => setPreview(null)} disabled={enviando}>Voltar</button>
                  <button className="kctl-btn ok" onClick={() => enviarRastreio(true)} disabled={enviando}>{enviando ? 'Aplicando…' : 'Confirmar substituição'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
