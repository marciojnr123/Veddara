'use client'

import { useEffect, useState } from 'react'

const GREETING_CSS = `
.vgreet { margin: 2px 0 0; }
.vgreet h2 {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  font-size: 38px;
  letter-spacing: -0.01em;
  color: #1e293b;
  margin: 0 0 4px;
  line-height: 1.1;
}
.vgreet h2 .nome {
  background: linear-gradient(90deg, #2563EB, #22C3DD);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.vgreet p { font-size: 15px; color: #94a3b8; margin: 0; }
@media (max-width: 640px) { .vgreet h2 { font-size: 28px; } }
`

function saudacaoPorHora(h: number): string {
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function Greeting() {
  const [nome, setNome] = useState<string>('')
  // hora só no cliente (evita divergência de fuso no SSR)
  const [saudacao, setSaudacao] = useState<string>('Olá')

  useEffect(() => {
    setSaudacao(saudacaoPorHora(new Date().getHours()))
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const completo: string = d?.user?.nome || ''
        const primeiro = completo.trim().split(/\s+/)[0] || completo
        setNome(primeiro)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="vgreet">
      <style dangerouslySetInnerHTML={{ __html: GREETING_CSS }} />
      <h2>
        {saudacao}{nome ? <>, <span className="nome">{nome}</span></> : ''}
      </h2>
      <p>Acompanhe sua operação em tempo real.</p>
    </div>
  )
}
