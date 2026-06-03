'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const SIDEBAR_CSS = `
.app-sidebar {
  background: #ffffff;
  border-right: 1px solid #e8edf3;
  padding: 24px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  width: 260px;
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
export function VeddaraLogo({ height = 34 }: { height?: number }) {
  const [erro, setErro] = useState(false)
  if (erro) return <VeddaraLogoSvg />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/veddara-logo.png"
      alt="VEDDARA"
      style={{ height, width: 'auto', display: 'block' }}
      onError={() => setErro(true)}
    />
  )
}

interface AppSidebarProps {
  children?: React.ReactNode
  onLogout?: () => void
}

export function AppSidebar({ children, onLogout }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    if (onLogout) {
      onLogout()
      return
    }
    fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login'))
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
            {NAV_ITEMS.map(item => (
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
