'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface MeUser { nome: string; email: string; role: string }

function useMe(): MeUser | null {
  const [me, setMe] = useState<MeUser | null>(null)
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setMe(d?.user ?? null))
      .catch(() => {})
  }, [])
  return me
}

function inicial(u: MeUser | null): string {
  const base = (u?.nome || u?.email || '?').trim()
  return base.charAt(0).toUpperCase()
}

const SIDEBAR_CSS = `
.app-sidebar {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 22px;
  box-shadow: 0 10px 34px rgba(30, 50, 90, 0.10);
  padding: 22px 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 16px;
  margin: 16px;
  height: calc(100vh - 32px);
  overflow: hidden;
  box-sizing: border-box;
}

.app-sidebar-logo {
  padding: 4px 6px 12px;
  border-bottom: 1px solid #f0f4f8;
  display: flex;
  justify-content: center;
  align-items: center;
}
.app-sidebar-logo img {
  height: 32px;
  width: auto;
  display: block;
}

.app-sidebar-nav-label {
  font-size: 10px;
  letter-spacing: 0.13em;
  color: #a0aec0;
  font-weight: 700;
  padding: 0 10px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.app-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-sidebar-nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  color: #64748b;
  text-decoration: none;
  font-size: 13.5px;
  font-weight: 500;
  transition: background 0.12s, color 0.12s;
  font-family: inherit;
}
.app-sidebar-nav a:hover {
  background: #f1f5f9;
  color: #1e293b;
}
.app-sidebar-nav a.active {
  background: linear-gradient(135deg, #eef2ff 0%, #e0f2fe 100%);
  color: #3b6fd4;
  font-weight: 600;
}
.app-sidebar-nav a svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.8;
}
.app-sidebar-nav a.active svg {
  opacity: 1;
}

.app-sidebar-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ===== Compact (icon-only) rail ===== */
.app-sidebar.compact {
  margin: 0; height: 100vh; top: 0;
  background: transparent; border: 0; box-shadow: none; border-radius: 0;
  backdrop-filter: none; -webkit-backdrop-filter: none;
  overflow: visible; position: relative; z-index: 200;
  display: flex; flex-direction: column; align-items: center;
  padding: 22px 12px;
}
.app-brand {
  align-self: flex-start;
  margin: 0 0 0 4px; padding: 0;
  display: flex; align-items: center; flex-shrink: 0;
}
.app-sidebar.compact .app-brand img,
.app-sidebar.compact .app-brand svg {
  width: 118px !important; height: auto !important; display: block;
}
.app-rail-card {
  margin: auto 0;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 22px;
  box-shadow: 0 10px 30px rgba(30, 50, 90, 0.12);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  padding: 10px 8px;
}
.app-rail-nav {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.app-rail-bottom {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.app-rail-user {
  width: 40px; height: 40px; border-radius: 50%;
  display: grid; place-items: center;
  background: #dbeafe; color: #2563eb;
  font-weight: 800; font-size: 15px; cursor: default;
}
.app-rail-user:hover { background: #cfe3fd; color: #1d4ed8; }
.app-rail-btn {
  position: relative;
  width: 40px; height: 40px; border-radius: 12px;
  display: grid; place-items: center;
  color: #9aa6b6; text-decoration: none;
  background: transparent; border: 0; cursor: pointer; padding: 0;
  transition: background .14s, color .14s, box-shadow .14s;
}
.app-rail-btn svg { width: 18px; height: 18px; }
.app-rail-btn:hover { background: #eef2f7; color: #475569; }
.app-rail-btn.active {
  background: #0b1220; color: #ffffff;
  box-shadow: 0 6px 16px rgba(11, 18, 32, 0.28);
}
.app-rail-btn::after {
  content: attr(data-label);
  position: absolute; left: calc(100% + 16px); top: 50%; transform: translateY(-50%);
  background: #0b1220; color: #fff; font-size: 12px; font-weight: 600;
  padding: 5px 10px; border-radius: 8px; white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity .12s; z-index: 300;
}
.app-rail-btn::before {
  content: ''; position: absolute; left: calc(100% + 10px); top: 50%;
  transform: translateY(-50%); border: 6px solid transparent;
  border-right-color: #0b1220; opacity: 0; transition: opacity .12s;
}
.app-rail-btn:hover::after, .app-rail-btn:hover::before { opacity: 1; }
`

const NAV_ITEMS = [
  {
    href: '/comercial',
    label: 'Comercial',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 14l3-3 3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18 5h2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/mercado',
    label: 'Mercado',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M3.5 9h17M3.5 15h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/vendedores',
    label: 'Vendedores',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM16 11a2.5 2.5 0 100-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 20a6 6 0 0112 0M15 14.5a5 5 0 016 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/estoque',
    label: 'Estoque',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M21 8l-9-5-9 5m18 0l-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/chat',
    label: 'Chat IA',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/catalogo',
    label: 'Catálogo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: 'Consulta',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 13l9-9 9 9M5 11v9h14v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/usuarios',
    label: 'Usuários',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

function VeddaraLogoSvg() {
  return (
    <svg viewBox="0 0 220 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: 30, width: 'auto' }}>
      <defs>
        <linearGradient id="vd-grad" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#4B6FE4"/>
          <stop offset="50%"  stopColor="#3EA8D8"/>
          <stop offset="100%" stopColor="#42C9BF"/>
        </linearGradient>
      </defs>
      <text
        x="0" y="36"
        fontFamily="'Plus Jakarta Sans', 'Rajdhani', 'Barlow Condensed', system-ui, sans-serif"
        fontWeight="800"
        fontSize="40"
        letterSpacing="-1"
        fill="url(#vd-grad)"
      >
        VEDDARA
      </text>
    </svg>
  )
}

// Usa a imagem real (public/veddara-logo.png) e cai no SVG vetorial se o arquivo não existir
export function VeddaraLogo({ height = 70 }: { height?: number }) {
  const [erro, setErro] = useState(false)
  if (erro) return <VeddaraLogoSvg />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="VEDDARA"
      style={{ height, width: 'auto', display: 'block' }}
      onError={() => setErro(true)}
    />
  )
}

interface AppSidebarProps {
  children?: React.ReactNode
  onLogout?: () => void
  hideLogo?: boolean
}

// Abas visíveis somente para admin
const ADMIN_ONLY = new Set(['/dashboard', '/catalogo', '/usuarios'])

export function AppSidebar({ children, onLogout, hideLogo }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const me = useMe()
  // Enquanto o cargo não carrega, escondemos as abas restritas (evita "piscar"
  // itens de admin para quem não é). Só aparecem quando confirmado role=admin.
  const navItems = NAV_ITEMS.filter(i => !ADMIN_ONLY.has(i.href) || me?.role === 'admin')
  const compact = !children

  function handleLogout() {
    if (onLogout) {
      onLogout()
      return
    }
    fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login'))
  }

  // Menu compacto (só ícones) — usado nas telas sem conteúdo extra na barra
  if (compact) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: SIDEBAR_CSS }} />
        <aside className="app-sidebar compact">
          {!hideLogo && (
            <div className="app-brand">
              <VeddaraLogo height={26} />
            </div>
          )}
          <div className="app-rail-card">
            <nav className="app-rail-nav">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-label={item.label}
                  className={`app-rail-btn ${pathname === item.href ? 'active' : ''}`}
                >
                  {item.icon}
                </Link>
              ))}
            </nav>
          </div>
          <div className="app-rail-bottom">
            {me && (
              <div className="app-rail-btn app-rail-user" data-label={`${me.nome} · ${me.email}`}>
                {inicial(me)}
              </div>
            )}
            <button className="app-rail-btn" data-label="Sair" onClick={handleLogout}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </aside>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SIDEBAR_CSS }} />
      <aside className="app-sidebar">

        {/* Logo */}
        <div className="app-sidebar-logo">
          <VeddaraLogo />
        </div>

        {/* Navigation */}
        <div>
          <div className="app-sidebar-nav-label">Menu</div>
          <nav className="app-sidebar-nav">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? 'active' : ''}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Page-specific content (suggestions, table list, etc.) */}
        {children && (
          <div className="app-sidebar-bottom">
            {children}
          </div>
        )}

        {/* Logout button at the bottom */}
        <div style={{ marginTop: children ? 0 : 'auto' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1px solid #e8edf3',
              color: '#94a3b8',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              const t = e.currentTarget
              t.style.background = '#f8fafc'
              t.style.color = '#475569'
            }}
            onMouseLeave={e => {
              const t = e.currentTarget
              t.style.background = 'transparent'
              t.style.color = '#94a3b8'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sair
          </button>
        </div>

      </aside>
    </>
  )
}
