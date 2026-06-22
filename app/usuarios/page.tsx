'use client'

import { useEffect, useState, useCallback } from 'react'
import { AppSidebar } from '@/components/AppSidebar'

const ROLES = ['admin', 'financeiro', 'consultor', 'operacao', 'user'] as const
type Role = (typeof ROLES)[number]

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  financeiro: 'Financeiro',
  consultor: 'Consultor',
  operacao: 'Operação',
  user: 'Usuário',
}
const ROLE_COLOR: Record<Role, string> = {
  admin: '#6d28d9',
  financeiro: '#0369a1',
  consultor: '#0e7490',
  operacao: '#b45309',
  user: '#475569',
}

interface Usuario {
  id: number
  name: string | null
  email: string
  role: Role
  active: boolean
  created_at: string
}

const CSS = `
.kusr-root, .kusr-root * { box-sizing: border-box; }
.kusr-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  display: grid;
  grid-template-columns: 150px 1fr;
  min-height: 100vh;
  background: linear-gradient(135deg, #eaf1fc 0%, #f2f6fc 45%, #fdeee7 100%);
  background-attachment: fixed;
  color: #1e293b;
}
.kusr-main { padding: 22px 26px 40px; min-width: 0; }
.kusr-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 8px; }
.kusr-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
.kusr-sub { font-size: 13px; color: #64748b; }
.kusr-grid { display: grid; grid-template-columns: 360px 1fr; gap: 18px; align-items: start; }
@media (max-width: 980px) { .kusr-grid { grid-template-columns: 1fr; } }

.kusr-card {
  background: #fff; border: 1px solid #e8edf3; border-radius: 18px;
  box-shadow: 0 8px 28px rgba(15,23,42,.05); padding: 20px;
}
.kusr-card h3 { margin: 0 0 16px; font-size: 15px; font-weight: 800; }

.kusr-field { margin-bottom: 13px; }
.kusr-field label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 5px; }
.kusr-field input, .kusr-field select {
  width: 100%; padding: 10px 12px; border: 1px solid #dbe2ea; border-radius: 10px;
  font-size: 13.5px; font-family: inherit; color: #1e293b; outline: none; background: #fff;
  transition: border-color .12s;
}
.kusr-field input:focus, .kusr-field select:focus { border-color: #3b6fd4; }

.kusr-btn {
  width: 100%; padding: 11px; border: 0; border-radius: 10px; cursor: pointer;
  background: linear-gradient(135deg, #3b6fe4, #4b8ff0); color: #fff;
  font-size: 14px; font-weight: 700; font-family: inherit; transition: filter .12s, opacity .12s;
}
.kusr-btn:hover { filter: brightness(1.05); }
.kusr-btn:disabled { opacity: .5; cursor: not-allowed; }

.kusr-msg { font-size: 12.5px; padding: 9px 12px; border-radius: 9px; margin-bottom: 12px; }
.kusr-msg.ok { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.kusr-msg.err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

.kusr-table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid #eef2f7; }
.kusr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.kusr-table th {
  text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700;
  color: #64748b; letter-spacing: .05em; text-transform: uppercase;
  background: #f8fafc; border-bottom: 1px solid #eef2f7; white-space: nowrap;
}
.kusr-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
.kusr-table tr:last-child td { border-bottom: 0; }
.kusr-table tr.inativo td { opacity: .5; }
.kusr-name { font-weight: 700; color: #1e293b; }
.kusr-email { color: #64748b; font-size: 12px; }

.kusr-badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.kusr-role-sel { padding: 5px 8px; border: 1px solid #dbe2ea; border-radius: 8px; font-size: 12.5px; font-family: inherit; cursor: pointer; background: #fff; }
.kusr-status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; }
.kusr-dot { width: 7px; height: 7px; border-radius: 999px; display: inline-block; }
.kusr-link-btn {
  background: transparent; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 5px 10px; font-size: 12px; font-weight: 600; font-family: inherit;
  cursor: pointer; color: #b91c1c; transition: background .12s;
}
.kusr-link-btn:hover { background: #fef2f2; }
.kusr-link-btn:disabled { opacity: .4; cursor: not-allowed; }

.kusr-empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 13.5px; }
.kusr-denied { max-width: 460px; margin: 80px auto; text-align: center; color: #475569; }
.kusr-denied h2 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #1e293b; }
`

export default function UsuariosPage() {
  const [me, setMe] = useState<{ role: Role } | null>(null)
  const [carregandoMe, setCarregandoMe] = useState(true)
  const [users, setUsers] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(false)

  // formulário
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  const carregarUsuarios = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setMe(d?.user ?? null))
      .finally(() => setCarregandoMe(false))
  }, [])

  useEffect(() => {
    if (me?.role === 'admin') carregarUsuarios()
  }, [me, carregarUsuarios])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setSalvando(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ tipo: 'err', texto: data.error || 'Erro ao criar usuário' })
        return
      }
      setMsg({ tipo: 'ok', texto: `Usuário ${data.user.email} criado!` })
      setName(''); setEmail(''); setPassword(''); setRole('user')
      carregarUsuarios()
    } catch {
      setMsg({ tipo: 'err', texto: 'Erro de conexão' })
    } finally {
      setSalvando(false)
    }
  }

  async function trocarCargo(id: number, novoCargo: Role) {
    const res = await fetch(`/api/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: novoCargo }),
    })
    if (res.ok) carregarUsuarios()
  }

  async function desativar(id: number) {
    if (!confirm('Desativar este usuário? Ele não poderá mais fazer login.')) return
    const res = await fetch(`/api/users/${id}/deactivate`, { method: 'PATCH' })
    if (res.ok) carregarUsuarios()
  }

  return (
    <div className="kusr-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppSidebar hideLogo />

      <div className="kusr-main">
        {carregandoMe ? null : me?.role !== 'admin' ? (
          <div className="kusr-denied">
            <h2>Acesso restrito</h2>
            <p>Apenas administradores podem gerenciar usuários.</p>
          </div>
        ) : (
          <>
            <div className="kusr-head">
              <div>
                <h1 className="kusr-title">Usuários</h1>
                <span className="kusr-sub">Crie, desative e defina o cargo de cada pessoa.</span>
              </div>
            </div>

            <div className="kusr-grid">
              {/* Formulário de criação */}
              <div className="kusr-card">
                <h3>Novo usuário</h3>
                {msg && <div className={`kusr-msg ${msg.tipo}`}>{msg.texto}</div>}
                <form onSubmit={criar}>
                  <div className="kusr-field">
                    <label>Nome</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="kusr-field">
                    <label>E-mail *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@veddara.com.br" required />
                  </div>
                  <div className="kusr-field">
                    <label>Senha *</label>
                    <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="mín. 6 caracteres" required />
                  </div>
                  <div className="kusr-field">
                    <label>Cargo</label>
                    <select value={role} onChange={e => setRole(e.target.value as Role)}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </div>
                  <button className="kusr-btn" disabled={salvando}>
                    {salvando ? 'Criando…' : 'Criar usuário'}
                  </button>
                </form>
              </div>

              {/* Lista */}
              <div className="kusr-card">
                <h3>Usuários cadastrados {users.length > 0 && `(${users.length})`}</h3>
                <div className="kusr-table-wrap">
                  <table className="kusr-table">
                    <thead>
                      <tr>
                        <th>Usuário</th>
                        <th>Cargo</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className={u.active ? '' : 'inativo'}>
                          <td>
                            <div className="kusr-name">{u.name || '—'}</div>
                            <div className="kusr-email">{u.email}</div>
                          </td>
                          <td>
                            <select
                              className="kusr-role-sel"
                              value={u.role}
                              onChange={e => trocarCargo(u.id, e.target.value as Role)}
                              style={{ color: ROLE_COLOR[u.role], fontWeight: 700 }}
                            >
                              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                            </select>
                          </td>
                          <td>
                            <span className="kusr-status" style={{ color: u.active ? '#047857' : '#94a3b8' }}>
                              <span className="kusr-dot" style={{ background: u.active ? '#10b981' : '#cbd5e1' }} />
                              {u.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="kusr-link-btn"
                              onClick={() => desativar(u.id)}
                              disabled={!u.active}
                            >
                              Desativar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={4}><div className="kusr-empty">{carregando ? 'Carregando…' : 'Nenhum usuário ainda.'}</div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
