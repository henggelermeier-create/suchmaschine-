import React, { useEffect, useRef, useState } from 'react'

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

export default function SearchSuggestBox({
  query,
  setQuery,
  onSubmit,
  onAiSearch,
  placeholder,
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      const value = String(query || '').trim()
      if (value.length < 2) {
        setItems([])
        return
      }
      setLoading(true)
      try {
        const next = await fetchSuggestions(value)
        setItems(next)
        setOpen(true)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 180)
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

  function submit(event) {
    event?.preventDefault?.()
    setOpen(false)
    onSubmit?.(query)
  }

  function submitAi(event) {
    event?.preventDefault?.()
    setOpen(false)
    onAiSearch?.(query)
  }

  const showDropdown = open && (loading || items.length > 0 || String(query || '').trim().length >= 2)

  return (
    <form ref={rootRef} className="ai-search-form" onSubmit={submit}>
      <div className="search-shell swiss-search-shell swiss-google-shell">
        <span className="swiss-search-icon" aria-hidden="true">⌕</span>
        <input
          value={query}
          onFocus={() => { if (items.length) setOpen(true) }}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(e)
          }}
          placeholder={placeholder}
        />
      </div>

      <div className="swiss-search-actions">
        <button className="btn swiss-search-action" type="submit">Suchen</button>
        <button className="btn btn-ghost swiss-search-action" type="button" onClick={submitAi}>Live KI Suche</button>
      </div>

      {showDropdown ? (
        <div className="swiss-suggest-dropdown">
          {loading ? <div className="muted swiss-suggest-empty">Vorschläge werden geladen …</div> : null}
          {!loading && items.length === 0 ? <div className="muted swiss-suggest-empty">Keine Vorschläge gefunden.</div> : null}
          {!loading && items.map((item, index) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => selectItem(item)}
              className="swiss-suggest-item"
              style={{ borderTop: index === 0 ? '0' : undefined }}
            >
              <div>
                <div className="swiss-suggest-title">{item.title}</div>
                <div className="muted small">{item.brand || '—'} · {item.shop_name || 'Shop'} · {item.offer_count} Anbieter</div>
              </div>
              <div className="swiss-suggest-side">
                <div>{formatPrice(item.price)}</div>
                <div className="muted small">{item.decision?.label || 'Vorschlag'}</div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </form>
  )
}
