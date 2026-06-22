'use client'

import { useState, useRef, useEffect } from 'react'

const CSS = `
.dtf-wrap { position: relative; display: inline-flex; align-items: center; gap: 10px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
.dtf-btn {
  display: inline-flex; align-items: center; gap: 9px;
  background: rgba(255,255,255,.85); border: 1px solid #e8edf3;
  border-radius: 12px; padding: 9px 15px; cursor: pointer;
  font-size: 13.5px; font-weight: 600; color: #1e293b; font-family: inherit;
  box-shadow: 0 1px 3px rgba(15,23,42,.05); transition: all .12s;
}
.dtf-btn:hover { background: #fff; border-color: #cbd5e1; }
.dtf-btn > svg:first-of-type { color: #64748b; flex-shrink: 0; }
.dtf-chev { color: #94a3b8; transition: transform .15s; }
.dtf-wrap.open .dtf-chev { transform: rotate(180deg); }
.dtf-menu {
  position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); z-index: 60;
  background: #fff; border: 1px solid #e8edf3; border-radius: 14px;
  box-shadow: 0 14px 36px rgba(15,23,42,.16); padding: 8px; min-width: 250px;
}
.dtf-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 10px 12px; border-radius: 9px; border: 0; background: transparent;
  font-size: 14px; font-weight: 500; color: #1e293b; cursor: pointer;
  font-family: inherit; text-align: left;
}
.dtf-item:hover { background: #f1f5f9; }
.dtf-item .dtf-check { margin-left: auto; color: #3b6fd4; flex-shrink: 0; }
.dtf-item.sel { font-weight: 700; }
.dtf-item > svg:first-child { color: #64748b; flex-shrink: 0; }
.dtf-div { height: 1px; background: #eef2f7; margin: 6px 4px; }
.dtf-custom { display: flex; align-items: center; gap: 8px; }
.dtf-date-group { display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,.85); border: 1px solid #e8edf3; border-radius: 10px; padding: 7px 11px; }
.dtf-date-group label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .03em; }
.dtf-date-input { border: 0; background: transparent; font-family: inherit; font-size: 12.5px; color: #1e293b; font-weight: 600; outline: none; color-scheme: light; cursor: pointer; }
`

const CAL = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 9.5h18M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)
const CHECK = (
  <svg className="dtf-check" width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function hojeISO() { return new Date().toISOString().slice(0, 10) }
function addDiasISO(n: number) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function inicioMesISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
function fmtBR(iso: string) { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}` }

const PRESETS = [
  { id: 'tudo', label: 'Tudo' },
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'mes', label: 'Este mês' },
]
function resolve(id: string): { inicio: string; fim: string } {
  const hoje = hojeISO()
  switch (id) {
    case 'hoje': return { inicio: hoje, fim: hoje }
    case '7d': return { inicio: addDiasISO(-6), fim: hoje }
    case '30d': return { inicio: addDiasISO(-29), fim: hoje }
    case '90d': return { inicio: addDiasISO(-89), fim: hoje }
    case 'mes': return { inicio: inicioMesISO(), fim: hoje }
    default: return { inicio: '', fim: '' } // tudo = histórico completo
  }
}

interface Props {
  onChange: (inicio: string, fim: string) => void
  defaultId?: string
}

export function DateFilter({ onChange, defaultId = 'tudo' }: Props) {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(defaultId) // id do preset ou 'custom'
  const [ini, setIni] = useState('')
  const [fim, setFim] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function escolher(id: string) {
    setSel(id); setOpen(false)
    const r = resolve(id)
    setIni(r.inicio); setFim(r.fim)
    onChange(r.inicio, r.fim)
  }
  function escolherCustom() {
    setSel('custom'); setOpen(false)
  }
  function mudarCustom(novoIni: string, novoFim: string) {
    setIni(novoIni); setFim(novoFim)
    if (novoIni && novoFim) onChange(novoIni, novoFim)
  }

  const label = sel === 'custom'
    ? (ini && fim ? `${fmtBR(ini)} – ${fmtBR(fim)}` : 'Personalizado')
    : (PRESETS.find(p => p.id === sel)?.label ?? 'Tudo')

  return (
    <div className={`dtf-wrap ${open ? 'open' : ''}`} ref={ref}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <button className="dtf-btn" onClick={() => setOpen(o => !o)}>
        {CAL}
        {label}
        <svg className="dtf-chev" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {sel === 'custom' && (
        <div className="dtf-custom">
          <div className="dtf-date-group">
            <label>De</label>
            <input type="date" className="dtf-date-input" value={ini} max={fim || undefined} onChange={e => mudarCustom(e.target.value, fim)} />
          </div>
          <div className="dtf-date-group">
            <label>Até</label>
            <input type="date" className="dtf-date-input" value={fim} min={ini || undefined} onChange={e => mudarCustom(ini, e.target.value)} />
          </div>
        </div>
      )}

      {open && (
        <div className="dtf-menu">
          {PRESETS.map(p => (
            <button key={p.id} className={`dtf-item ${sel === p.id ? 'sel' : ''}`} onClick={() => escolher(p.id)}>
              {p.label}
              {sel === p.id && CHECK}
            </button>
          ))}
          <div className="dtf-div" />
          <button className={`dtf-item ${sel === 'custom' ? 'sel' : ''}`} onClick={escolherCustom}>
            {CAL}
            Personalizado…
            {sel === 'custom' && CHECK}
          </button>
        </div>
      )}
    </div>
  )
}
