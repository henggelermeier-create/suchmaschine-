import React, { useEffect, useState } from 'react'

const ADMIN_TOKEN_KEY = 'kauvio_admin_token'

function readAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function clearAdminToken() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {}
}

function routeNow() {
  return window.location.hash.replace(/^#/, '') || '/'
}

async function adminApi(url, options = {}) {
  const token = readAdminToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Fehler')
    err.status = res.status
    throw err
  }
  return data
}

export default function AdminPasswordOverlay() {
  const [route, setRoute] = useState(routeNow())
  const [token, setToken] = useState(readAdminToken())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    const sync = () => {
      setRoute(routeNow())
      setToken(readAdminToken())
    }
    window.addEventListener('hashchange', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  if (route !== '/admin' || !token) return null

  async function submit(e) {
    e.preventDefault()
    setMessage('')

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setMessage('Bitte alle Passwort-Felder ausfüllen.')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      setMessage('Die neuen Passwörter stimmen nicht überein.')
      return
    }

    setSaving(true)
    try {
      const result = await adminApi('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      clearAdminToken()
      setToken('')
      window.alert(result.message || 'Passwort geändert. Bitte neu einloggen.')
      window.location.hash = '/admin/login'
    } catch (err) {
      setMessage(err.message || 'Passwort konnte nicht geändert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 50, width: 'min(420px, calc(100vw - 24px))' }}>
      <form className="panel" onSubmit={submit}>
        <div className="section-head">
          <div>
            <h2>Admin-Passwort ändern</h2>
            <p className="muted no-margin">Nach dem Speichern wirst du automatisch abgemeldet.</p>
          </div>
        </div>
        <div className="stack">
          <label className="field"><span>Aktuelles Passwort</span><input type="password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} /></label>
          <label className="field"><span>Neues Passwort</span><input type="password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} /></label>
          <label className="field"><span>Neues Passwort bestätigen</span><input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} /></label>
          {message ? <div className="error-box">{message}</div> : null}
          <button className="btn btn-small" disabled={saving}>{saving ? 'Speichert…' : 'Passwort speichern'}</button>
          <div className="login-hint">Falls du das aktuelle Passwort nicht kennst, setze in Coolify `ADMIN_PASSWORD` neu und aktiviere einmalig `ADMIN_PASSWORD_FORCE_RESET=1`.</div>
        </div>
      </form>
    </div>
  )
}
