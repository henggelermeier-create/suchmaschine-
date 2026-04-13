import React, { useEffect, useMemo, useRef, useState } from 'react'

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
  return value != null ? `CHF ${Number(value).toFixed(2)}` : '-'
}

function formatDate(value) {
  if (!value) return '-'
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

function Header() {
  return (
    <header className="topbar topbar-pro">
      <a className="brandlink" href="#/">
        <div className="brand brand-modern">
          <div className="brand-wordmark">
            <span className="brand-dot" />
            <span className="brand-name">
              KAUVIO<span className="brand-point">.</span>
            </span>
          </div>
        </div>
      </a>
    </header>
  )
}

function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <div className="muted">{title}</div>
      <strong>{value}</strong>
    </div>
  )
}

function SearchCard({ item }) {
  const href = `#/product/${item.slug}`
  return (
    <a className="result-card-pro" href={href}>
      <div className="result-card-copy">
        <div className="result-card-title">{item.title}</div>
        <div className="result-card-meta">
          {item.brand || '-'} · {item.category || 'Produkt'} · {item.offer_count || 0} Shops
        </div>
        <div className="result-card-submeta">
          Bestpreis · {formatPrice(item.price)}{item.shop_name ? ` · ${item.shop_name}` : ''}
        </div>
      </div>
      <div className="result-card-side">
        <span className="result-pill">{item.deal_label || item.decision?.label || 'KI Vergleich'}</span>
        <strong className="price-inline">{formatPrice(item.price)}</strong>
      </div>
    </a>
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
  const progressPercent = targetProducts > 0 ? Math.min(100, Math.round((currentProducts / targetProducts) * 100)) : null

  let label = 'KI Status unbekannt'
  if (!engineRuntime) label = 'KI Status unbekannt'
  else if (engineRuntime.is_enabled === false || mode === 'stop') label = 'KI steht'
  else if (mode === 'pause') label = 'KI pausiert'
  else if (runningTasks > 0) label = 'KI laeuft'
  else if (pendingTasks > 0) label = 'KI ist aktiv und hat Warteschlange'
  else label = 'KI ist aktiviert'

  return {
    label,
    mode,
    runningTasks,
    pendingTasks,
    currentProducts,
    targetProducts,
    progressPercent,
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
        setPollMessage('Live Suche laeuft weiter ...')
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
  const adminMessageIsError = /fehler|failed|ungueltig|nicht/i.test(adminMessage || '')
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
      <div className="shell center gradient-bg">
        <div className="login-card login-card-pro">
          <div className="brand-row">
            <div className="logo">K</div>
            <div>
              <div className="brand-name dark">KAUVIO</div>
              <div className="muted">AI first Admin</div>
            </div>
          </div>
          <h1 className="login-title">Admin Login</h1>
          <form className="stack" onSubmit={loginAdmin}>
            <label className="field">
              <span>E Mail</span>
              <input value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
            </label>
            <label className="field">
              <span>Passwort</span>
              <input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
            </label>
            {loginError ? <div className="error-box">{loginError}</div> : null}
            <button className="btn btn-xl">Einloggen</button>
          </form>
        </div>
      </div>
    )
  }

  if (route === '/admin') {
    const aiProducts = systemHealth?.checks?.canonical_products?.count ?? dashboard?.stats?.products ?? '-'
    const aiOffers = systemHealth?.checks?.source_offers_v2?.count ?? dashboard?.stats?.offers ?? '-'

    return (
      <div className="shell">
        <Header />
        <main className="content admin-content admin-final-layout">
          <section className="hero admin-hero panel hero-banner admin-banner">
            <div>
              <div className="badge">AI first Kern</div>
              <h1 className="section-title">Kauvio Admin</h1>
              <p className="section-text">Suchstart, Discovery, Warteliste und Schweizer Quellen an einem Ort.</p>
            </div>
            <div className="row gap-sm wrap">
              <button className="btn btn-small btn-ghost" onClick={refreshAdminData}>Neu laden</button>
              <button className="btn btn-small btn-ghost" onClick={logoutAdmin}>Abmelden</button>
            </div>
          </section>

          {adminMessage ? (
            <section className={`panel ${adminMessageIsError ? 'status-error' : 'status-success'}`}>
              <p className="no-margin">{adminMessage}</p>
            </section>
          ) : null}
          {adminLoading ? (
            <section className="panel">
              <p className="muted no-margin">Admin Daten werden geladen ...</p>
            </section>
          ) : null}

          <section className="panel">
            <div className="section-head">
              <div>
                <h2>KI Engine Status</h2>
                <p className="muted no-margin">Sichtbar, ob die KI wirklich arbeitet.</p>
              </div>
            </div>
            <div className="stats-grid stats-grid-6">
              <Stat title="Status" value={engineStatus.label || '-'} />
              <Stat title="Modus" value={engineStatus.mode || '-'} />
              <Stat title="Laufende Jobs" value={engineStatus.runningTasks ?? engineStatus.runningTasks ?? engineStatus.running ?? 0} />
              <Stat title="Wartende Jobs" value={engineStatus.pendingTasks ?? engineStatus.pending ?? 0} />
              <Stat title="Aktuelle KI Produkte" value={engineStatus.currentProducts ?? aiProducts} />
              <Stat title="Zielmenge" value={engineStatus.targetProducts || '-'} />
            </div>
          </section>

          <section className="stats-grid stats-grid-6 admin-kpi-grid">
            <Stat title="KI Produkte" value={aiProducts} />
            <Stat title="KI Offers" value={aiOffers} />
            <Stat title="Suchjobs" value={dashboard?.stats?.searchTasks ?? '-'} />
            <Stat title="Open Web" value={dashboard?.stats?.openWebPages ?? '-'} />
            <Stat title="Seeds" value={dashboard?.stats?.autonomousSeeds ?? '-'} />
            <Stat title="Gelernt" value={dashboard?.stats?.learnedQueries ?? '-'} />
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <h2>KI Suche starten</h2>
                <p className="muted no-margin">Direkter Live Start fuer neue Produktsuche.</p>
              </div>
            </div>
            <div className="row gap-sm wrap">
              <input value={aiSearchQuery} onChange={(e) => setAiSearchQuery(e.target.value)} placeholder="z. B. iPhone 16 Pro 256 GB" />
              <button className="btn btn-small" onClick={startAdminAiSearch}>KI Suche starten</button>
            </div>
          </section>

          <div className="admin-grid admin-grid-main">
            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>KI Controls</h2>
                  <p className="muted no-margin">Zentrale Schalter fuer Engine und Discovery.</p>
                </div>
              </div>
              <div className="stack">
                {aiControls
                  .filter((control) => ['engine_runtime', 'open_web_discovery', 'small_shop_balance', 'autonomous_builder'].includes(control.control_key))
                  .map((control) => (
                    <div className="offer-edit-card" key={control.control_key}>
                      <div className="row line no-border">
                        <div>
                          <strong>{control.control_key}</strong>
                          <div className="muted">{control.description || '-'}</div>
                        </div>
                        <div className="muted">{formatDate(control.updated_at)}</div>
                      </div>
                      <label className="field">
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
                      <label className="field">
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
                      <button className="btn btn-small" onClick={() => saveAiControl(control.control_key)}>Speichern</button>
                    </div>
                  ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>Warteliste und Discovery</h2>
                  <p className="muted no-margin">Was gerade gesucht wird und was die KI findet.</p>
                </div>
              </div>
              <div className="stack">
                <div className="subpanel light-panel">
                  <strong>Suchanfragen</strong>
                  <div className="stack mt-16">
                    {activeRequests.length ? activeRequests.map((item) => (
                      <div className="row line" key={item.id}>
                        <div>
                          <strong>{item.query}</strong>
                          <div className="muted">{item.status}</div>
                        </div>
                        <div className="muted">{item.result_count || 0} Resultate</div>
                      </div>
                    )) : <div className="muted" style={{ marginTop: 12 }}>Keine offenen Suchanfragen sichtbar.</div>}
                  </div>
                </div>
                <div className="subpanel light-panel">
                  <strong>Open Web Treffer</strong>
                  <div className="stack mt-16">
                    {webDiscoveryResults.length ? webDiscoveryResults.slice(0, 6).map((item) => (
                      <div className="row line" key={item.id}>
                        <div>
                          <strong>{item.result_title || item.source_domain || 'Treffer'}</strong>
                          <div className="muted">{item.source_domain || '-'}</div>
                        </div>
                        <div className="muted">{item.discovered_product ? 'Produkt' : item.discovered_shop ? 'Shop' : 'Treffer'}</div>
                      </div>
                    )) : <div className="muted" style={{ marginTop: 12 }}>Noch keine Open Web Treffer sichtbar.</div>}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Schweizer Quellen</h2>
                <p className="muted no-margin">Wichtige Quellen mit Schnellsteuerung.</p>
              </div>
            </div>
            <div className="stack">
              {swissSources.slice(0, 10).map((source) => (
                <div className="offer-edit-card" key={source.source_key}>
                  <div className="row line no-border">
                    <div>
                      <strong>{source.display_name}</strong>
                      <div className="muted">{source.source_key}{source.shop_domain ? ` · ${source.shop_domain}` : ''}</div>
                    </div>
                    <div className="muted">{source.last_runtime_status || 'kein Status'}</div>
                  </div>
                  <div className="grid two-col">
                    <label className="field">
                      <span>Prioritaet</span>
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
                    <label className="field">
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
                    <label className="field">
                      <span>Kleiner Shop</span>
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
                    </label>
                    <label className="field">
                      <span>Aktiv</span>
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
                    </label>
                  </div>
                  <button className="btn btn-small" onClick={() => saveSwissSource(source.source_key)}>Quelle speichern</button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Letzte Suchjobs</h2>
                <p className="muted no-margin">Direkt sehen, ob Imports laufen oder scheitern.</p>
              </div>
            </div>
            <div className="stack">
              {searchTasks.length ? searchTasks.slice(0, 8).map((task) => (
                <div className="row line" key={task.id}>
                  <div>
                    <strong>{task.query}</strong>
                    <div className="muted">{task.status} · {task.strategy}</div>
                  </div>
                  <div className="muted">{task.imported_count || 0} Imports · {task.discovered_count || 0} Discovery</div>
                </div>
              )) : <div className="muted">Noch keine Suchjobs sichtbar.</div>}
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (selected && route.startsWith('/product/')) {
    return (
      <div className="shell">
        <Header />
        <main className="content product-page">
          <section className="panel product-hero-panel">
            <div className="badge">{selected.deal_label || selected.decision?.label || 'KI Vergleich'}</div>
            <h1 className="product-title">{selected.title}</h1>
            <p className="product-copy">{selected.ai_summary || 'KI aufbereiteter Produktvergleich fuer die Schweiz.'}</p>
            <div className="detail-list">
              <div><span>Marke</span><strong>{selected.brand || '-'}</strong></div>
              <div><span>Kategorie</span><strong>{selected.category || '-'}</strong></div>
              <div><span>Bestpreis</span><strong>{formatPrice(selected.price)}</strong></div>
            </div>
          </section>
          <section className="panel comparison-panel">
            <div className="section-head">
              <div>
                <h2>Preisvergleich</h2>
                <p className="muted no-margin">Bestpreis und alle Shops mit Direktlink.</p>
              </div>
            </div>
            <div className="offers-table">
              {(selected.offers || []).map((offer, index) => (
                <div className={`offer-row ${index === 0 ? 'offer-row-best' : ''}`} key={`${offer.shop_name}-${index}`}>
                  <div className="offer-shop">
                    <strong>{offer.shop_name}</strong>
                    <div className="muted">Zuletzt aktualisiert: {formatDate(offer.updated_at)}</div>
                  </div>
                  <div className="offer-row-right">
                    <strong className="offer-price">{formatPrice(offer.price)}</strong>
                    <a className="btn btn-small" href={`/r/${selected.slug}/${encodeURIComponent(offer.shop_name)}`} target="_blank" rel="noreferrer">Zum Shop</a>
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
    <div className="shell">
      <Header />
      <main className="content home-content">
        <section className="panel home-simple">
          <div className="home-logo">KAUVIO<span className="brand-point">.</span></div>
          <p className="home-subtitle">AI first Produktsuche Schweiz</p>
          <h1 className="home-title">Die KI findet, priorisiert und vergleicht Schweizer Produkte.</h1>
          <p className="home-lead">Suche direkt im Index oder starte bei Bedarf sofort eine Live KI Suche ueber Schweizer Quellen.</p>
          <div className="search-shell hero-search home-search-centered">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch(query)
              }}
              placeholder="z. B. iPhone 16 Pro, Dyson V15 oder Sony WH 1000XM6"
            />
            <button className="btn hero-search-btn" onClick={() => runSearch(query)}>Suchen</button>
          </div>
        </section>

        {liveSearch ? (
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>KI Suche laeuft</h2>
                <p className="muted no-margin">{liveSearch.userVisibleNote || 'Die KI sammelt gerade Schweizer Quellen.'}</p>
              </div>
            </div>
            <div className="row gap-sm wrap">
              <div className="subpanel light-panel"><strong>Suchauftrag</strong><div className="muted">{liveSearch.query || query}</div></div>
              <div className="subpanel light-panel"><strong>Status</strong><div className="muted">{liveSearch.status || 'pending'}</div></div>
              <div className="subpanel light-panel"><strong>Strategie</strong><div className="muted">{liveSearch.strategy || 'swiss_ai_live'}</div></div>
            </div>
            {pollMessage ? <p className="muted" style={{ marginTop: 12 }}>{pollMessage}</p> : null}
          </section>
        ) : null}

        {searchError ? (
          <section className="panel status-error">
            <p className="no-margin">{searchError}</p>
          </section>
        ) : null}

        {!loading && !featured.length && query.trim() ? (
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Keine lokalen Resultate</h2>
                <p className="muted no-margin">Starte die Live KI Suche jetzt sofort.</p>
              </div>
            </div>
            <button className="btn btn-small" onClick={startPublicAiSearch}>KI Suche jetzt starten</button>
          </section>
        ) : null}

        <section className="panel search-results-panel">
          <div className="section-head">
            <div>
              <h2>Ergebnisse</h2>
              <p className="muted no-margin">Bestpreis, Deal Label und gefundene Shops.</p>
            </div>
          </div>
          {loading ? (
            <div className="empty-state">
              <h3>Suche laeuft</h3>
              <p>Die aktuellen Ergebnisse werden geladen.</p>
            </div>
          ) : featured.length ? (
            <div className="results-list-pro">
              {featured.map((item) => <SearchCard item={item} key={item.slug} />)}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Noch keine Resultate</h3>
              <p>Starte eine Suche oder direkt die KI Suche.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
