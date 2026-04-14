import React, { useEffect, useState } from 'react'
import HomePageProfessional from './HomePageProfessional.jsx'
import App from './App.jsx'
import './swiss-home.css'

function routeNow() {
  return window.location.hash.replace(/^#/, '') || '/'
}

async function fetchHomeItems() {
  const res = await fetch('/api/products?limit=6')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Produkte konnten nicht geladen werden.')
  return { items: data.items || [], liveSearch: data.liveSearch || null }
}

export default function Root() {
  const [route, setRoute] = useState(routeNow())
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [liveSearch, setLiveSearch] = useState(null)

  useEffect(() => {
    const onHash = () => setRoute(routeNow())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (route !== '/') return
    setLoadingProducts(true)
    fetchHomeItems()
      .then(({ items, liveSearch }) => {
        setItems(items)
        setLiveSearch(liveSearch)
      })
      .catch(() => {
        setItems([])
        setLiveSearch(null)
      })
      .finally(() => setLoadingProducts(false))
  }, [route])

  function runSearch(nextQuery) {
    const cleaned = String(nextQuery || '').trim()
    if (!cleaned) return
    window.location.hash = `/search?q=${encodeURIComponent(cleaned)}`
  }

  if (route !== '/') return <App />

  return (
    <div className="shell swiss-shell">
      <HomePageProfessional
        query={query}
        setQuery={setQuery}
        loadingProducts={loadingProducts}
        items={items}
        liveSearch={liveSearch}
        onSearch={runSearch}
      />
    </div>
  )
}
