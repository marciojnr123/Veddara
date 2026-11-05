'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { limparCacheUsuario } from '@/components/AppSidebar'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

// Símbolo √ da marca (mesmo desenho do logo), usado como decoração do fundo
function MarcaCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1080 1350" aria-hidden="true">
      <polygon points="40,673 194,673 400,1153 882,62 1039,62 478,1287 313,1287" />
    </svg>
  )
}

// Logo sem o espaço vazio do arquivo: o /logo.png (809×388) só tem desenho entre
// as linhas ~144 e ~243, então mostramos só a faixa 140–248 (proporção 809/108).
function LogoVeddara({ className }: { className?: string }) {
  return (
    <div className={`klog-logo-crop ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="VEDDARA" />
    </div>
  )
}

const CSS = `
.klog-root, .klog-root * { box-sizing: border-box; }
.klog-root {
  position: relative; min-height: 100vh; overflow: hidden; overflow: clip;
  display: grid; grid-template-columns: 1.1fr 1fr; align-items: center; gap: 40px;
  padding: 40px clamp(24px, 6vw, 96px);
  color: #1e293b; -webkit-font-smoothing: antialiased;
  /* Degradê "mesh" da Veddara: bege/laranja → azul → ciano → quase branco */
  background:
    radial-gradient(55% 60% at 0% 12%, rgba(212,160,112,.95) 0%, rgba(212,160,112,0) 62%),
    radial-gradient(60% 65% at 85% 5%, rgba(80,118,238,1) 0%, rgba(80,118,238,0) 68%),
    radial-gradient(75% 50% at 15% 105%, rgba(236,249,251,1) 0%, rgba(236,249,251,0) 60%),
    radial-gradient(90% 55% at 65% 100%, rgba(118,214,236,1) 0%, rgba(118,214,236,0) 72%),
    radial-gradient(70% 30% at 20% 78%, rgba(70,190,208,.75) 0%, rgba(70,190,208,0) 70%),
    linear-gradient(160deg, #9aa3c7 0%, #5b86df 42%, #4f9fdc 70%, #a6e2f0 100%);
}

/* Decoração: √ gigante translúcido + linhas diagonais no canto, numa camada que não rola */
.klog-deco { position: absolute; inset: 0; overflow: hidden; overflow: clip; pointer-events: none; z-index: 0; }
.klog-check { position: absolute; right: -8vw; bottom: -18vh; height: 125vh; width: auto; fill: #fff; opacity: .13; pointer-events: none; animation: klogfloat 14s ease-in-out infinite; }
.klog-lines { position: absolute; right: 0; bottom: 0; width: 140px; height: 140px; pointer-events: none; opacity: .5;
  background: repeating-linear-gradient(-60deg, transparent 0 9px, rgba(255,255,255,.9) 9px 10px);
  -webkit-mask-image: linear-gradient(135deg, transparent 45%, #000 100%); mask-image: linear-gradient(135deg, transparent 45%, #000 100%); }
@keyframes klogfloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-18px) } }
@media (prefers-reduced-motion: reduce) { .klog-check { animation: none; } }

/* Lado da marca */
.klog-logo-crop { aspect-ratio: 809 / 108; overflow: hidden; }
.klog-logo-crop img { display: block; width: 100%; height: auto; margin-top: -17.3%; }
.klog-brand { position: relative; z-index: 1; color: #fff; max-width: 560px; }
.klog-lockup { width: min(460px, 82%); }
.klog-lockup .klog-logo-crop img { filter: brightness(0) invert(1); }
.klog-lockup { filter: drop-shadow(0 4px 18px rgba(20,40,90,.18)); }
/* frase com a mesma largura do logo (como na arte oficial) */
.klog-tag { display: block; width: 100%; height: auto; margin-top: 4.5%; fill: #fff; font-family: inherit; font-weight: 500; }
.klog-bar { width: 84px; height: 4px; border-radius: 999px; margin: 26px 0 22px; background: linear-gradient(90deg, #4B6FE4, #3EC0BF, #FF8A00); box-shadow: 0 2px 10px rgba(0,0,0,.08); }
.klog-lead { font-size: 15.5px; line-height: 1.6; font-weight: 500; color: rgba(255,255,255,.92); max-width: 420px; margin: 0; text-shadow: 0 1px 10px rgba(20,40,90,.2); }

/* Cartão de login (vidro) */
.klog-card {
  position: relative; z-index: 1; justify-self: center; width: 100%; max-width: 420px;
  background: rgba(255,255,255,.86); backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid rgba(255,255,255,.7); border-radius: 24px; padding: 36px 34px 30px;
  box-shadow: 0 24px 70px rgba(25,45,100,.22), 0 2px 6px rgba(25,45,100,.06);
}
.klog-card-logo { width: 128px; margin: 0 0 22px; }
.klog-h1 { font-size: 24px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: #0f1c3f; }
.klog-sub { font-size: 13.5px; color: #64748b; margin: 6px 0 26px; }
.klog-field { margin-bottom: 16px; }
.klog-label { display: block; font-size: 12.5px; font-weight: 700; color: #334155; margin-bottom: 6px; }
.klog-input-wrap { position: relative; }
.klog-input {
  width: 100%; padding: 12px 14px; font-size: 14.5px; font-family: inherit; color: #0f172a;
  background: #fff; border: 1px solid #d8e0ec; border-radius: 12px; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.klog-input::placeholder { color: #a3aec0; }
.klog-input:focus { border-color: #4B6FE4; box-shadow: 0 0 0 4px rgba(75,111,228,.16); }
.klog-input.pwd { padding-right: 46px; }
.klog-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border: 0; background: transparent; border-radius: 9px; color: #8a97ab; cursor: pointer; display: grid; place-items: center; }
.klog-eye:hover { color: #334155; background: #f1f5f9; }
.klog-eye:focus-visible { outline: 2px solid #4B6FE4; outline-offset: 1px; }
.klog-err { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 11px; padding: 10px 13px; font-size: 13px; margin-bottom: 16px; }
.klog-btn {
  width: 100%; margin-top: 6px; padding: 13px; border: 0; border-radius: 12px; cursor: pointer;
  font-family: inherit; font-size: 15px; font-weight: 700; color: #fff; letter-spacing: .01em;
  background: linear-gradient(90deg, #4B6FE4 0%, #3EA8D8 55%, #42C9BF 100%);
  box-shadow: 0 10px 24px rgba(75,111,228,.32); transition: filter .15s, transform .08s, opacity .15s;
}
.klog-btn:hover { filter: brightness(1.06); }
.klog-btn:active { transform: translateY(1px); }
.klog-btn:disabled { opacity: .6; cursor: not-allowed; }
.klog-btn:focus-visible { outline: 3px solid rgba(75,111,228,.45); outline-offset: 2px; }
.klog-foot { margin-top: 22px; text-align: center; font-size: 11.5px; color: #94a3b8; }

/* Celular / telas estreitas: empilha marca + cartão */
@media (max-width: 900px) {
  .klog-root { grid-template-columns: 1fr; gap: 28px; padding: 36px 20px; align-content: center; }
  .klog-brand { justify-self: center; width: 100%; display: flex; justify-content: center; }
  .klog-lockup { width: min(300px, 80vw); }
  .klog-bar, .klog-lead { display: none; }
  .klog-card { padding: 30px 24px 26px; }
  .klog-card-logo { display: none; }
  .klog-check { right: -30vw; height: 90vh; }
}
`

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao fazer login')
        return
      }
      limparCacheUsuario()
      router.push('/dashboard')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`klog-root ${jakarta.className}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="klog-deco" aria-hidden="true">
        <MarcaCheck className="klog-check" />
        <div className="klog-lines" />
      </div>

      <div className="klog-brand">
        <div>
          <div className="klog-lockup">
            <LogoVeddara />
            <svg className="klog-tag" viewBox="0 0 809 44" role="img" aria-label="Longevidade com qualidade">
              <text x="5" y="36" fontSize="35" textLength="797" lengthAdjust="spacing">LONGEVIDADE COM QUALIDADE</text>
            </svg>
          </div>
          <div className="klog-bar" />
          <p className="klog-lead">Comercial, mercado, estoque e rastreio da Veddara num só lugar, atualizados em tempo real.</p>
        </div>
      </div>

      <form className="klog-card" onSubmit={handleSubmit}>
        <LogoVeddara className="klog-card-logo" />
        <h1 className="klog-h1">Bem-vindo de volta</h1>
        <p className="klog-sub">Entre com seu e-mail e senha da Veddara.</p>

        <div className="klog-field">
          <label className="klog-label" htmlFor="klog-email">E-mail</label>
          <input
            id="klog-email"
            className="klog-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="voce@veddara.com.br"
          />
        </div>

        <div className="klog-field">
          <label className="klog-label" htmlFor="klog-senha">Senha</label>
          <div className="klog-input-wrap">
            <input
              id="klog-senha"
              className="klog-input pwd"
              type={verSenha ? 'text' : 'password'}
              autoComplete="current-password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              placeholder="••••••••"
            />
            <button
              type="button"
              className="klog-eye"
              onClick={() => setVerSenha(v => !v)}
              aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
              title={verSenha ? 'Esconder senha' : 'Mostrar senha'}
            >
              {verSenha ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.1 6.1C4.2 7.4 2.7 9.4 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>
              )}
            </button>
          </div>
        </div>

        {erro && <div className="klog-err" role="alert">{erro}</div>}

        <button type="submit" className="klog-btn" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="klog-foot">Acesso restrito à equipe Veddara</div>
      </form>
    </div>
  )
}
