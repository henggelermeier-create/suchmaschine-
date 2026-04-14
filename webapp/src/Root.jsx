import React, { useEffect, useMemo, useRef, useState } from 'react'
import App from './App.jsx'
import HomePageProfessional from './HomePageProfessional.jsx'
import './swiss-home.css'

function routeNow() {
  return window.location.hash.replace(/^#/, '') || '/'
}

async function fetchProducts(query = '') {
  const url = `/api/products${query ? `?q=${encodeURIComponent(query)}` : ''}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Produkte konnten nicht geladen werden.')
  return { items: data.items || [], liveSearch: data.liveSearch || null }
}

async function startAiSearch(query = '') {
  const res = await fetch('/api/ai/search/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'KI-Suche konnte nicht gestartet werden.')
  return data.task || null
}

export default function Root() {
  const [route, setRoute] = useState(routeNow())
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [liveSearch, setLiveSearch] = useState(null)
  const [error, setError] = useState('')
  const [pollMessage, setPollMessage] = useState('')
  const pollRef = useRef(null)

  useEffect(() => {
    const onHash = () => setRoute(routeNow())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!(route === '/' || route === '/search')) return
    const targetQuery = route === '/search' ? activeQuery : ''
    setLoadingProducts(true)
    setError('')
    fetchProducts(targetQuery)
      .then(({ items, liveSearch }) => {
        setProducts(items)
        setLiveSearch(liveSearch)
      })
      .catch((err) => {
        setProducts([])
        setLiveSearch(null)
        setError(err.message || 'Produkte konnten nicht geladen werden.')
      })
      .finally(() => setLoadingProducts(false))
  }, [route, activeQuery])

  useEffect(() => {
    if (!(route === '/search' && activeQuery && liveSearch)) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      setPollMessage('')
      return
    }

    if (pollRef.current) clearInterval(pollRef.current)
    setPollMessage('Die KI durchsucht Schweizer Quellen live …')

    pollRef.current = setInterval(async () => {
      try {
        const refreshed = await fetchProducts(activeQuery)
        setProducts(refreshed.items || [])
        setLiveSearch(refreshed.liveSearch || null)
        if ((refreshed.items || []).length > 0 && !refreshed.liveSearch) {
          setPollMessage('Neue Resultate wurden gefunden.')
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch {
        setPollMessage('Die Live-Suche läuft weiter …')
      }
    }, 8000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [route, activeQuery, liveSearch])

  const featured = useMemo(() => (
    route === '/search'
      ? products.slice(0, 16)
      : products.slice(0, 8)
  ), [products, route])

  async function handleSubmitSearch(nextQuery = query) {
    const cleaned = String(nextQuery || '').trim()
    if (!cleaned) return
    setActiveQuery(cleaned)
    setQuery(cleaned)
    window.location.hash = '/search'
  }

  async function handleStartLiveSearch(nextQuery = query) {
    const cleaned = String(nextQuery || '').trim()
    if (!cleaned) return
    setLoadingProducts(true)
    setError('')
    try {
      const task = await startAiSearch(cleaned)
      setActiveQuery(cleaned)
      setQuery(cleaned)
      setLiveSearch(task)
      window.location.hash = '/search'
      const refreshed = await fetchProducts(cleaned)
      setProducts(refreshed.items || [])
      setLiveSearch(refreshed.liveSearch || task)
    } catch (err) {
      setError(err.message || 'KI-Suche konnte nicht gestartet werden.')
    } finally {
      setLoadingProducts(false)
    }
  }

  if (!(route === '/' || route === '/search')) {
    return <App />
  }

  return (
    <div className="shell swiss-shell">
      <HomePageProfessional
        route={route}
        query={query}
        setQuery={setQuery}
        activeQuery={activeQuery}
        loadingProducts={loadingProducts}
        featured={featured}
        products={products}
        liveSearch={liveSearch}
        error={error}
        pollMessage={pollMessage}
        onSubmitSearch={handleSubmitSearch}
        onStartLiveSearch={handleStartLiveSearch}
      />
    </div>
  )
}
