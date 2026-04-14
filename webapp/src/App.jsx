import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BadgeSwissFranc,
  BarChart3,
  Bot,
  Database,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trophy,
  ScanSearch,
} from 'lucide-react'
import { LogoWordmark } from './Brand.jsx'

const ADMIN_TOKEN_KEY = 'kauvio_admin_token'

function routeNow() {
  return window.location.hash.replace(/^#/, '') || '/'
}

function readAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function persistAdminToken(token) {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token)
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    }
  } catch {}
}

async function api(url, options = {}) {
  const token = readAdminToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token && url.startsWith('/api/admin')) {
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Fehler')
    err.status = res.status
    throw err
  }
  return data
}

function formatPrice(value) {
  return value != null ? `CHF ${Number(value).toFixed(2)}` : '—'
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('de-CH')
  } catch {
    return String(value)
  }
}

function parseJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value
  if (typeof value === 'string' && value.trim()) {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return fallback
}

function BrandHeader({ admin = false }) {
  return (
    <header className="brand-topbar">
      <a className="brand-topbar-logo" href="#/">
        <LogoWordmark small align="left" />
      </a>
      <div className="brand-topbar-actions">
        <span className={`brand-chip ${admin ? 'brand-chip--red' : 'brand-chip--blue'}`}>
          {admin ? <Settings2 size={14} /> : <Sparkles size={14} />}
          {admin ? 'Admin' : 'AI Search'}
        </span>
      </div>
    </header>
  )
}

function StatusChip({ icon: Icon, label, tone = 'slate' }) {
  return (
    <span className={`brand-chip brand-chip--${tone}`}>
      <Icon size={14} />
      <span>{label}</span>
    </span>
  )
}

function SearchCard({ item }) {
  const href = `#/product/${item.slug}`
  return (
    <a className="brand-list-card" href={href}>
      <div>
        <div className="brand-list-title">{item.title}</div>
        <div className="brand-list-meta">
          {item.brand || '—'} · {item.category || 'Produkt'} · {item.offer_count || 0} Shops
        </div>
      </div>
      <div className="brand-list-side">
        <span className={`brand-pill ${Number(item.deal_score || 0) >= 88 ? 'brand-pill--red' : 'brand-pill--blue'}`}>
          {item.deal_label || item.decision?.label || 'KI Vergleich'}
        </span>
        <strong className="brand-price">{formatPrice(item.price)}</strong>
      </div>
    </a>
  )
}

function AdminStat({ title, value, icon: Icon, tone = 'slate' }) {
  return (
    <div className="brand-admin-stat">
      <div>
        <div className="brand-admin-stat-label">{title}</div>
        <strong className="brand-admin-stat-value">{value}</strong>
      </div>
      <div className={`brand-admin-stat-icon brand-admin-stat-icon--${tone}`}>
        <Icon size={18} />
      </div>
    </div>
  )
}

function deriveEngineStatus(dashboard, aiControls, searchTasks, systemHealth) {
  if (dashboard?.engineStatus) return dashboard.engineStatus

  const byKey = new Map((aiControls || []).map((item) => [item.control_key, item]))
  const engineRuntime = byKey.get('engine_runtime')
  const autonomousBuilder = byKey.get('autonomous_builder')
  const engineJson = parseJson(engineRuntime?.control_value_json, {})
  const autonomousJson = parseJson(autonomousBuilder?.control_value_json, {})
  const mode = String(engineJson.mode || 'run').toLowerCase()
  const runningTasks = (searchTasks || []).filter((item) => item.status === 'running').length
  const pendingTasks = (searchTasks || []).filter((item) => item.status === 'pending').length
  const currentProducts = Number(systemHealth?.checks?.canonical_products?.count || 0)
  const targetProducts = Number(autonomousJson.target_canonical_products || engineJson.target_products || 0)

  let label = 'KI ist aktiviert'
  if (!engineRuntime) label = 'KI Status unbekannt'
  else if (engineRuntime.is_enabled === false || mode === 'stop') label = 'KI steht'
  else if (mode === 'pause') label = 'KI pausiert'
  else if (runningTasks > 0) label = 'KI läuft'
  else if (pendingTasks > 0) label = 'KI arbeitet an Warteschlange'

  return {
    label,
    mode,
    runningTasks,
    pendingTasks,
    currentProducts,
    targetProducts,
  }
}

export default function App() {
  const [route, setRoute] = useState(routeNow())
  const [adminToken, setAdminToken] = useState(readAdminToken())

  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)
  const [liveSearch, setLiveSearch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [pollMessage, setPollMessage] = useState('')
  const pollRef = useRef(null)

  const [login, setLogin] = useState({ email: 'admin@kauvio.ch', password: '' })
  const [loginError, setLoginError] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  const [aiSearchQuery, setAiSearchQuery] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [systemHealth, setSystemHealth] = useState(null)
  const [searchTasks, setSearchTasks] = useState([])
  const [searchRequests, setSearchRequests] = useState([])
  const [webDiscoveryResults, setWebDiscoveryResults] = useState([])
  const [aiControls, setAiControls] = useState([])
  const [aiControlEditor, setAiControlEditor] = useState({})
  const [swissSources, setSwissSources] = useState([])
  const [swissSourceEditor, setSwissSourceEditor] = useState({})

  useEffect(() => {
    const onHash = () => setRoute(routeNow())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onStorage = () => setAdminToken(readAdminToken())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const match = route.match(/^\/product\/(.+)$/)
    if (!match) return
    api(`/api/products/${match[1]}`)
      .then(setSelected)
      .catch(() => setSelected(null))
  }, [route])

  useEffect(() => {
    if (route !== '/admin') return
    if (!adminToken) {
      window.location.hash = '/admin/login'
      return
    }
    refreshAdminData()
  }, [route, adminToken])

  useEffect(() => {
    if (!liveSearch?.query || products.length > 0) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      if (products.length > 0) setPollMessage('')
      return
    }
    if (pollRef.current) clearInterval(pollRef.current)
    setPollMessage('Die KI sucht live weiter ...')
    pollRef.current = setInterval(async () => {
      try {
        const data = await api(`/api/products?q=${encodeURIComponent(liveSearch.query)}`)
        setProducts(data.items || [])
        setLiveSearch(data.liveSearch || null)
        if ((data.items || []).length > 0) {
          setPollMessage('Neue Resultate wurden gefunden.')
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch {
        setPollMessage('Live Suche läuft weiter ...')
      }
    }, 8000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [liveSearch?.query, products.length])

  const featured = useMemo(() => products.slice(0, 20), [products])
  const engineStatus = useMemo(
    () => deriveEngineStatus(dashboard, aiControls, searchTasks, systemHealth),
    [dashboard, aiControls, searchTasks, systemHealth]
  )
  const activeRequests = useMemo(() => {
    if ((searchRequests || []).length) return searchRequests.slice(0, 6)
    return (searchTasks || [])
      .filter((item) => ['pending', 'running'].includes(item.status))
      .slice(0, 6)
      .map((item) => ({
        id: `task-${item.id}`,
        query: item.query,
        status: item.status,
        result_count: item.result_count || 0,
      }))
  }, [searchRequests, searchTasks])

  async function runSearch(nextQuery) {
    const cleaned = String(nextQuery || '').trim()
    if (!cleaned) return
    setSearchError('')
    setPollMessage('')
    setLoading(true)
    try {
      const data = await api(`/api/products?q=${encodeURIComponent(cleaned)}`)
      setProducts(data.items || [])
      setLiveSearch(data.liveSearch || null)
      window.location.hash = '/search'
    } catch (err) {
      setProducts([])
      setLiveSearch(null)
      setSearchError(err.message || 'Suche fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  async function startPublicAiSearch() {
    const cleaned = String(query || '').trim()
    if (!cleaned) return
    setSearchError('')
    setLoading(true)
    try {
      const data = await api('/api/ai/search/start', {
        method: 'POST',
        body: JSON.stringify({ query: cleaned }),
      })
      setLiveSearch(data.task || null)
      const refreshed = await api(`/api/products?q=${encodeURIComponent(cleaned)}`)
      setProducts(refreshed.items || [])
      setLiveSearch(refreshed.liveSearch || data.task || null)
      window.location.hash = '/search'
    } catch (err) {
      setSearchError(err.message || 'KI Suche konnte nicht gestartet werden.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshAdminData() {
    setAdminLoading(true)
    try {
      const [dash, health, tasks, requests, discoveries, controls, swiss] = await Promise.all([
        api('/api/admin/dashboard'),
        api('/api/admin/system-health').catch(() => ({ checks: {} })),
        api('/api/admin/search-tasks').catch(() => ({ items: [] })),
        api('/api/admin/search-requests').catch(() => ({ items: [] })),
        api('/api/admin/web-discovery-results').catch(() => ({ items: [] })),
        api('/api/admin/ai/controls').catch(() => ({ items: [] })),
        api('/api/admin/swiss-sources').catch(() => ({ items: [] })),
      ])
      setDashboard(dash)
      setSystemHealth(health)
      setSearchTasks(tasks.items || [])
      setSearchRequests(requests.items || [])
      setWebDiscoveryResults(discoveries.items || [])
      setAiControls(controls.items || [])
      setSwissSources(swiss.items || [])

      const nextControlEditor = {}
      for (const item of controls.items || []) {
        nextControlEditor[item.control_key] = {
          is_enabled: !!item.is_enabled,
          control_value_json: JSON.stringify(item.control_value_json || {}, null, 2),
        }
      }
      setAiControlEditor(nextControlEditor)

      const nextSwissEditor = {}
      for (const item of swiss.items || []) {
        nextSwissEditor[item.source_key] = {
          priority: item.priority ?? 0,
          manual_boost: item.manual_boost ?? 0,
          is_active: item.is_active !== false,
          is_small_shop: !!item.is_small_shop,
        }
      }
      setSwissSourceEditor(nextSwissEditor)
    } catch (err) {
      if (err?.status === 401) {
        persistAdminToken('')
        setAdminToken('')
        window.location.hash = '/admin/login'
      } else {
        setAdminMessage(err.message || 'Admin Daten konnten nicht geladen werden.')
      }
    } finally {
      setAdminLoading(false)
    }
  }

  async function loginAdmin(event) {
    event.preventDefault()
    setLoginError('')
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(login),
      })
      persistAdminToken(data.token)
      setAdminToken(data.token)
      window.location.hash = '/admin'
    } catch (err) {
      setLoginError(err.message || 'Login fehlgeschlagen')
    }
  }

  function logoutAdmin() {
    persistAdminToken('')
    setAdminToken('')
    window.location.hash = '/admin/login'
  }

  async function startAdminAiSearch() {
    const cleaned = String(aiSearchQuery || '').trim()
    if (!cleaned) return
    try {
      const data = await api('/api/admin/ai/search/start', {
        method: 'POST',
        body: JSON.stringify({ query: cleaned }),
      })
      setAdminMessage(`KI Suche gestartet: ${data.task?.query || cleaned}`)
      await refreshAdminData()
    } catch (err) {
      setAdminMessage(err.message || 'KI Suche konnte nicht gestartet werden.')
    }
  }

  async function saveAiControl(controlKey) {
    const payload = aiControlEditor[controlKey]
    if (!payload) return
    try {
      await api(`/api/admin/ai/controls/${encodeURIComponent(controlKey)}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_enabled: !!payload.is_enabled,
          control_value_json: payload.control_value_json,
        }),
      })
      setAdminMessage(`AI Control gespeichert: ${controlKey}`)
      await refreshAdminData()
    } catch (err) {
      setAdminMessage(err.message || `AI Control konnte nicht gespeichert werden: ${controlKey}`)
    }
  }

  async function saveSwissSource(sourceKey) {
    const payload = swissSourceEditor[sourceKey]
    if (!payload) return
    try {
      await api(`/api/admin/swiss-sources/${encodeURIComponent(sourceKey)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setAdminMessage(`Schweizer Quelle gespeichert: ${sourceKey}`)
      await refreshAdminData()
    } catch (err) {
      setAdminMessage(err.message || `Quelle konnte nicht gespeichert werden: ${sourceKey}`)
    }
  }

  if (route === '/admin/login' && adminToken) {
    window.location.hash = '/admin'
    return null
  }

  if (route === '/admin/login') {
    return (
      <div className="brand-auth-shell">
        <div className="brand-auth-card">
          <LogoWordmark align="left" />
          <h1 className="brand-auth-title">Admin Login</h1>
          <p className="brand-auth-text">Dieselbe Markenwelt wie im Frontend: ruhig, klar und fokussiert.</p>
          <form className="brand-form-stack" onSubmit={loginAdmin}>
            <label className="brand-field">
              <span>E-Mail</span>
              <input value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
            </label>
            <label className="brand-field">
              <span>Passwort</span>
              <input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
            </label>
            {loginError ? <div className="brand-error-box">{loginError}</div> : null}
            <button className="brand-primary-button brand-primary-button--full">Einloggen</button>
          </form>
        </div>
      </div>
    )
  }

  if (route === '/admin') {
    const aiProducts = systemHealth?.checks?.canonical_products?.count ?? dashboard?.stats?.products ?? '—'
    const aiOffers = systemHealth?.checks?.source_offers_v2?.count ?? dashboard?.stats?.offers ?? '—'

    return (
      <div className="brand-app-shell">
        <BrandHeader admin />
        <main className="brand-admin-page">
          <section className="brand-admin-hero">
            <div>
              <div className="brand-kicker brand-kicker--red"><Settings2 size={14} /> Admin · Go Live</div>
              <h1>Ein Designsystem für Frontend und Admin.</h1>
              <p>Blau für Suche und AI, Rot für Schweiz und Trust, Slate für Ruhe und Lesbarkeit.</p>
            </div>
            <div className="brand-admin-hero-actions">
              <button className="brand-secondary-button" onClick={refreshAdminData}>Neu laden</button>
              <button className="brand-secondary-button" onClick={logoutAdmin}>Abmelden</button>
            </div>
          </section>

          {adminMessage ? <section className="brand-inline-message">{adminMessage}</section> : null}
          {adminLoading ? <section className="brand-inline-muted">Admin Daten werden geladen ...</section> : null}

          <section className="brand-admin-stats-grid">
            <AdminStat title="Status" value={engineStatus.label || '—'} icon={Activity} tone="blue" />
            <AdminStat title="KI Produkte" value={aiProducts} icon={Database} tone="slate" />
            <AdminStat title="KI Offers" value={aiOffers} icon={Bot} tone="blue" />
            <AdminStat title="Suchjobs" value={dashboard?.stats?.searchTasks ?? '—'} icon={Search} tone="red" />
            <AdminStat title="Open Web" value={dashboard?.stats?.openWebPages ?? '—'} icon={ScanSearch} tone="blue" />
            <AdminStat title="Schweizer Quellen" value={dashboard?.stats?.autonomousSeeds ?? '—'} icon={Store} tone="red" />
          </section>

          <section className="brand-section-panel">
            <div className="brand-section-head">
              <div>
                <h2>KI Suche starten</h2>
                <p>Dieselbe Button- und Flächensprache wie auf der Startseite.</p>
              </div>
            </div>
            <div className="brand-admin-searchbar">
              <div className="brand-search-inputwrap brand-search-inputwrap--flat">
                <Search className="brand-search-icon" />
                <input value={aiSearchQuery} onChange={(e) => setAiSearchQuery(e.target.value)} placeholder="z. B. iPhone 16 Pro 256 GB" />
              </div>
              <button className="brand-primary-button" onClick={startAdminAiSearch}>KI Suche starten</button>
            </div>
          </section>

          <section className="brand-admin-grid brand-admin-grid--two">
            <div className="brand-section-panel">
              <div className="brand-section-head">
                <div>
                  <h2>AI Controls</h2>
                  <p>Gemeinsame Farblogik und identische Komponenten.</p>
                </div>
                <SlidersHorizontal size={18} className="brand-muted-icon" />
              </div>
              <div className="brand-stack-list">
                {aiControls
                  .filter((control) => ['engine_runtime', 'open_web_discovery', 'small_shop_balance', 'autonomous_builder'].includes(control.control_key))
                  .map((control) => (
                    <div className="brand-control-card" key={control.control_key}>
                      <div className="brand-control-head">
                        <div>
                          <strong>{control.control_key}</strong>
                          <div className="brand-meta-inline">{control.description || 'AI Control'}</div>
                        </div>
                        <span className={`brand-pill ${control.is_enabled ? 'brand-pill--blue' : 'brand-pill--slate'}`}>
                          {control.is_enabled ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <label className="brand-field brand-field--checkbox">
                        <span>Aktiv</span>
                        <input
                          type="checkbox"
                          checked={!!aiControlEditor[control.control_key]?.is_enabled}
                          onChange={(e) =>
                            setAiControlEditor({
                              ...aiControlEditor,
                              [control.control_key]: {
                                ...aiControlEditor[control.control_key],
                                is_enabled: e.target.checked,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="brand-field">
                        <span>JSON</span>
                        <textarea
                          rows="4"
                          value={aiControlEditor[control.control_key]?.control_value_json || ''}
                          onChange={(e) =>
                            setAiControlEditor({
                              ...aiControlEditor,
                              [control.control_key]: {
                                ...aiControlEditor[control.control_key],
                                control_value_json: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <button className="brand-secondary-button brand-secondary-button--left" onClick={() => saveAiControl(control.control_key)}>Speichern</button>
                    </div>
                  ))}
              </div>
            </div>

            <div className="brand-section-panel">
              <div className="brand-section-head">
                <div>
                  <h2>Warteliste und Discovery</h2>
                  <p>Admin und Frontend wirken wie aus einem Guss.</p>
                </div>
                <Bot size={18} className="brand-muted-icon" />
              </div>
              <div className="brand-stack-list">
                <div className="brand-subcard">
                  <strong>Offene Suchanfragen</strong>
                  <div className="brand-sublist">
                    {activeRequests.length ? activeRequests.map((item) => (
                      <div className="brand-subrow" key={item.id}>
                        <div>
                          <strong>{item.query}</strong>
                          <div className="brand-meta-inline">{item.status}</div>
                        </div>
                        <span className="brand-pill brand-pill--blue">{item.result_count || 0} Resultate</span>
                      </div>
                    )) : <div className="brand-meta-inline">Keine offenen Suchanfragen sichtbar.</div>}
                  </div>
                </div>
                <div className="brand-subcard">
                  <strong>Open Web Treffer</strong>
                  <div className="brand-sublist">
                    {webDiscoveryResults.length ? webDiscoveryResults.slice(0, 6).map((item) => (
                      <div className="brand-subrow" key={item.id}>
                        <div>
                          <strong>{item.result_title || item.source_domain || 'Treffer'}</strong>
                          <div className="brand-meta-inline">{item.source_domain || '—'}</div>
                        </div>
                        <span className={`brand-pill ${item.discovered_product ? 'brand-pill--red' : 'brand-pill--slate'}`}>
                          {item.discovered_product ? 'Produkt' : item.discovered_shop ? 'Shop' : 'Treffer'}
                        </span>
                      </div>
                    )) : <div className="brand-meta-inline">Noch keine Open Web Treffer sichtbar.</div>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="brand-admin-grid brand-admin-grid--two">
            <div className="brand-section-panel">
              <div className="brand-section-head">
                <div>
                  <h2>Schweizer Quellen</h2>
                  <p>Rote Akzente für Schweiz, blaue für aktive Suche.</p>
                </div>
                <Store size={18} className="brand-muted-icon" />
              </div>
              <div className="brand-stack-list">
                {swissSources.slice(0, 10).map((source) => (
                  <div className="brand-control-card" key={source.source_key}>
                    <div className="brand-control-head">
                      <div>
                        <strong>{source.display_name}</strong>
                        <div className="brand-meta-inline">{source.source_key}{source.shop_domain ? ` · ${source.shop_domain}` : ''}</div>
                      </div>
                      <span className={`brand-pill ${source.is_active ? 'brand-pill--red' : 'brand-pill--slate'}`}>
                        {source.last_runtime_status || 'kein Status'}
                      </span>
                    </div>
                    <div className="brand-two-col-grid">
                      <label className="brand-field">
                        <span>Priorität</span>
                        <input
                          value={swissSourceEditor[source.source_key]?.priority ?? ''}
                          onChange={(e) =>
                            setSwissSourceEditor({
                              ...swissSourceEditor,
                              [source.source_key]: {
                                ...swissSourceEditor[source.source_key],
                                priority: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                      <label className="brand-field">
                        <span>Boost</span>
                        <input
                          value={swissSourceEditor[source.source_key]?.manual_boost ?? ''}
                          onChange={(e) =>
                            setSwissSourceEditor({
                              ...swissSourceEditor,
                              [source.source_key]: {
                                ...swissSourceEditor[source.source_key],
                                manual_boost: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="brand-inline-controls">
                      <label className="brand-field brand-field--checkbox-inline">
                        <input
                          type="checkbox"
                          checked={!!swissSourceEditor[source.source_key]?.is_small_shop}
                          onChange={(e) =>
                            setSwissSourceEditor({
                              ...swissSourceEditor,
                              [source.source_key]: {
                                ...swissSourceEditor[source.source_key],
                                is_small_shop: e.target.checked,
                              },
                            })
                          }
                        />
                        <span>Kleiner Shop</span>
                      </label>
                      <label className="brand-field brand-field--checkbox-inline">
                        <input
                          type="checkbox"
                          checked={!!swissSourceEditor[source.source_key]?.is_active}
                          onChange={(e) =>
                            setSwissSourceEditor({
                              ...swissSourceEditor,
                              [source.source_key]: {
                                ...swissSourceEditor[source.source_key],
                                is_active: e.target.checked,
                              },
                            })
                          }
                        />
                        <span>Aktiv</span>
                      </label>
                    </div>
                    <button className="brand-secondary-button brand-secondary-button--left" onClick={() => saveSwissSource(source.source_key)}>Quelle speichern</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="brand-section-panel">
              <div className="brand-section-head">
                <div>
                  <h2>Letzte Suchjobs</h2>
                  <p>Dasselbe Kartenraster wie im Frontend.</p>
                </div>
                <Activity size={18} className="brand-muted-icon" />
              </div>
              <div className="brand-stack-list">
                {searchTasks.length ? searchTasks.slice(0, 8).map((task) => (
                  <div className="brand-subrow brand-subrow--card" key={task.id}>
                    <div>
                      <strong>{task.query}</strong>
                      <div className="brand-meta-inline">{task.status} · {task.strategy}</div>
                    </div>
                    <div className="brand-stack-inline-right">
                      <span className="brand-pill brand-pill--blue">{task.imported_count || 0} Imports</span>
                      <span className="brand-pill brand-pill--slate">{task.discovered_count || 0} Discovery</span>
                    </div>
                  </div>
                )) : <div className="brand-meta-inline">Noch keine Suchjobs sichtbar.</div>}
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (selected && route.startsWith('/product/')) {
    return (
      <div className="brand-app-shell">
        <BrandHeader />
        <main className="brand-product-page">
          <section className="brand-product-hero">
            <div className="brand-kicker"><Sparkles size={14} /> KI Vergleich</div>
            <h1>{selected.title}</h1>
            <p>{selected.ai_summary || 'KI aufbereiteter Produktvergleich für die Schweiz.'}</p>
            <div className="brand-chip-row">
              <StatusChip icon={Trophy} label={selected.deal_label || selected.decision?.label || 'KI Vergleich'} tone="red" />
              <StatusChip icon={Store} label={selected.shop_name || 'Schweizer Shop'} tone="slate" />
              <StatusChip icon={BadgeSwissFranc} label={formatPrice(selected.price)} tone="blue" />
            </div>
          </section>

          <section className="brand-section-panel">
            <div className="brand-section-head">
              <div>
                <h2>Preisvergleich</h2>
                <p>Gleiches Designsystem wie Startseite und Admin.</p>
              </div>
            </div>
            <div className="brand-offers-table">
              {(selected.offers || []).map((offer, index) => (
                <div className={`brand-offer-row ${index === 0 ? 'brand-offer-row--best' : ''}`} key={`${offer.shop_name}-${index}`}>
                  <div>
                    <strong>{offer.shop_name}</strong>
                    <div className="brand-meta-inline">Zuletzt aktualisiert: {formatDate(offer.updated_at)}</div>
                  </div>
                  <div className="brand-offer-right">
                    <strong className="brand-price">{formatPrice(offer.price)}</strong>
                    <a className="brand-primary-button brand-primary-button--compact" href={`/r/${selected.slug}/${encodeURIComponent(offer.shop_name)}`} target="_blank" rel="noreferrer">
                      Zum Shop
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="brand-app-shell">
      <BrandHeader />
      <main className="brand-page">
        <section className="brand-hero-card brand-hero-card--compact">
          <LogoWordmark />
          <h1 className="brand-hero-title">AI-first Produktsuche für die Schweiz.</h1>
          <p className="brand-hero-lead">Dasselbe ruhige Design wie auf der Startseite – auch auf internen Seiten und Fallback-Ansichten.</p>
          <div className="brand-search-shell brand-search-shell--standalone">
            <div className="brand-search-inputwrap">
              <Search className="brand-search-icon" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(query) }}
                placeholder="z. B. iPhone 16 Pro, Dyson V15 oder Sony WH-1000XM6"
                className="brand-search-input"
              />
            </div>
            <button className="brand-primary-button" onClick={() => runSearch(query)}>Suchen</button>
          </div>
          <div className="brand-chip-row">
            <StatusChip icon={Trophy} label="Bestpreis" tone="red" />
            <StatusChip icon={Bot} label="Live AI" tone="blue" />
            <StatusChip icon={Store} label="Schweizer Shops" tone="slate" />
          </div>
        </section>

        {liveSearch ? (
          <section className="brand-status-panel brand-status-panel--blue">
            <div>
              <div className="brand-status-label">KI Suche läuft</div>
              <div className="brand-status-text">{liveSearch.userVisibleNote || 'Die KI sammelt gerade Schweizer Quellen.'}</div>
            </div>
            <div className="brand-status-metrics">
              <span className="brand-chip brand-chip--blue"><Bot size={14} /> {liveSearch.status || 'pending'}</span>
              <span className="brand-chip brand-chip--slate"><ScanSearch size={14} /> {liveSearch.strategy || 'swiss_ai_live'}</span>
            </div>
          </section>
        ) : null}

        {searchError ? <section className="brand-error-box brand-error-box--inline">{searchError}</section> : null}

        {!loading && !featured.length && query.trim() ? (
          <section className="brand-section-panel">
            <div className="brand-section-head">
              <div>
                <h2>Keine lokalen Resultate</h2>
                <p>Starte die Live KI Suche jetzt sofort.</p>
              </div>
            </div>
            <button className="brand-primary-button brand-primary-button--compact" onClick={startPublicAiSearch}>KI Suche jetzt starten</button>
          </section>
        ) : null}

        <section className="brand-section-panel">
          <div className="brand-section-head">
            <div>
              <h2>Ergebnisse</h2>
              <p>Bestpreis, Deal Label und gefundene Shops – im selben Stil wie überall sonst.</p>
            </div>
          </div>
          {loading ? (
            <div className="brand-empty-state">
              <h3>Suche läuft</h3>
              <p>Die aktuellen Ergebnisse werden geladen.</p>
            </div>
          ) : featured.length ? (
            <div className="brand-list-grid">
              {featured.map((item) => <SearchCard item={item} key={item.slug} />)}
            </div>
          ) : (
            <div className="brand-empty-state">
              <h3>Noch keine Resultate</h3>
              <p>Starte eine Suche oder direkt die KI Suche.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
