import React, { useEffect, useRef, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'

const formatPrice = (value) => value != null ? `CHF ${Number(value).toFixed(2)}` : '—'

async function fetchSuggestions(query) {
  const q = String(query || '').trim()
  if (q.length < 2) return []

  async function request(url) {
    const res = await fetch(url)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Fehler')
    return data.items || []
  }

  try {
    return (await request(`/api/products/suggest?q=${encodeURIComponent(q)}`)).slice(0, 8)
  } catch {
    return (await request(`/api/products?q=${encodeURIComponent(q)}`)).slice(0, 8)
  }
}

export default function SearchSuggestBox({ query, setQuery, href = '#/search', placeholder }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (String(query || '').trim().length < 2) {
        setItems([])
        return
      }
      setLoading(true)
      try {
        const next = await fetchSuggestions(query)
        setItems(next)
        setOpen(true)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])

  function selectItem(item) {
    setQuery(item.title)
    setOpen(false)
    window.location.hash = `/product/${item.slug}`
  }

  const showDropdown = open && (loading || items.length > 0 || String(query || '').trim().length >= 2)

  return (
    <div ref={rootRef} className="search-suggest-root">
      <div className="brand-search-shell">
        <div className="brand-search-inputwrap">
          <Search className="brand-search-icon" />
          <input
            value={query}
            onFocus={() => { if (items.length) setOpen(true) }}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="brand-search-input"
          />
        </div>
        <a className="brand-primary-button" href={href}>
          Preise vergleichen
        </a>
      </div>

      {showDropdown ? (
        <div className="brand-suggest-dropdown">
          {loading ? <div className="brand-suggest-state">Vorschläge werden geladen…</div> : null}
          {!loading && items.length === 0 ? <div className="brand-suggest-state">Keine Vorschläge gefunden.</div> : null}
          {!loading && items.map((item, index) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => selectItem(item)}
              className={`brand-suggest-item ${index === 0 ? 'brand-suggest-item--first' : ''}`}
            >
              <div className="brand-suggest-copy">
                <div className="brand-suggest-title">{item.title}</div>
                <div className="brand-suggest-meta">
                  <span>{item.brand || '—'}</span>
                  <span>·</span>
                  <span>{item.shop_name || 'Shop'}</span>
                  <span>·</span>
                  <span>{item.offer_count} Anbieter</span>
                </div>
              </div>
              <div className="brand-suggest-side">
                <div className="brand-suggest-price">{formatPrice(item.price)}</div>
                <div className="brand-suggest-pill"><Sparkles size={13} /> {item.decision?.label || 'Vorschlag'}</div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
