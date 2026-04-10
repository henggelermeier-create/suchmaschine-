import React, { useEffect, useMemo, useState } from 'react'
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
  return data.items || []
}

export default function Root() {
  const [route, setRoute] = useState(routeNow())
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  useEffect(() => {
    const onHash = () => setRoute(routeNow())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!(route === '/' || route === '/search')) return
    setLoadingProducts(true)
    fetchProducts(query)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false))
  }, [route, query])

  const featured = useMemo(() => products.slice(0, 6), [products])

  if (!(route === '/' || route === '/search')) {
    return <App />
  }

  return (
    <div className="shell swiss-shell">
      <HomePageProfessional
        query={query}
        setQuery={setQuery}
        loadingProducts={loadingProducts}
        featured={featured}
        products={products}
      />
    </div>
  )
}
