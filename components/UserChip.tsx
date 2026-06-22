'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const CHIP_CSS = `
.vchip-wrap { position: relative; }
.vchip {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 1px solid #e8edf3; border-radius: 999px;
  padding: 5px 14px 5px 5px; cursor: pointer; font-family: inherit;
  box-shadow: 0 4px 14px rgba(15,23,42,.06); transition: border-color .12s;
}
.vchip:hover { border-color: #cdd8e6; }
.vchip-av {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  background: #d8eefb; color: #4aa3da;
  display: grid; place-items: center; font-weight: 800; font-size: 16px;
}
.vchip-info { text-align: left; line-height: 1.2; }
.vchip-name { font-size: 14px; font-weight: 800; color: #1e293b; }
.vchip-email { font-size: 12px; color: #94a3b8; }
.vchip-chev { color: #cbd5e1; flex-shrink: 0; transition: transform .15s; }
.vchip-wrap.open .vchip-chev { transform: rotate(180deg); }
.vchip-backdrop { position: fixed; inset: 0; z-index: 40; }
.vchip-menu {
  position: absolute; right: 0; top: calc(100% + 8px); z-index: 50;
  background: #fff; border: 1px solid #e8edf3; border-radius: 12px;
  box-shadow: 0 12px 30px rgba(15,23,42,.14); padding: 6px; min-width: 170px;
}
.vchip-menu button {
  width: 100%; text-align: left; background: transparent; border: 0;
  padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
  color: #b91c1c; cursor: pointer; font-family: inherit;
  display: flex; align-items: center; gap: 8px;
}
.vchip-menu button:hover { background: #fef2f2; }
@media (max-width: 640px) { .vchip-info { display: none; } }
`

interface MeUser { nome: string; email: string; role: string }

export function UserChip() {
  const router = useRouter()
  const [me, setMe] = useState<MeUser | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setMe(d?.user ?? null))
      .catch(() => {})
  }, [])

  function logout() {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login'))
  }

  if (!me) return null
  const inicial = (me.nome || me.email || '?').trim().charAt(0).toUpperCase()

  return (
    <div className={`vchip-wrap${open ? ' open' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CHIP_CSS }} />
      <div className="vchip" onClick={() => setOpen(v => !v)}>
        <div className="vchip-av">{inicial}</div>
        <div className="vchip-info">
          <div className="vchip-name">{me.nome}</div>
          <div className="vchip-email">{me.email}</div>
        </div>
        <svg className="vchip-chev" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
        <>
          <div className="vchip-backdrop" onClick={() => setOpen(false)} />
          <div className="vchip-menu">
            <button onClick={logout}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  )
}
