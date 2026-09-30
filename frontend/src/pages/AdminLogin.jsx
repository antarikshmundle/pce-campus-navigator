import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { auth } from '../lib/auth.js'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const expired = useLocation().state?.expired

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api.login(username, password)
      auth.setToken(res.access_token)
      navigate('/admin')
    } catch {
      setError('Incorrect username or password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy font-sans flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-surface rounded-card p-8 shadow-float">
        <div className="text-micro font-semibold uppercase tracking-wide text-accent-dark">PCE Campus Navigator</div>
        <h1 className="text-heading text-fg mt-1 mb-6">Admin sign in</h1>
        {expired && <p role="status" className="mb-4 rounded-control bg-accent-soft px-3 py-2 text-caption text-fg">Your session ended. Please sign in again.</p>}

        <label className="block text-sm font-medium text-fg mb-1">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-control border border-line px-3 py-2 mb-4 text-sm outline-none focus:ring-2 focus:ring-accent"
          autoFocus
        />

        <label className="block text-sm font-medium text-fg mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-control border border-line px-3 py-2 mb-4 text-sm outline-none focus:ring-2 focus:ring-accent"
        />

        {error && <p role="alert" className="text-error text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-control bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
