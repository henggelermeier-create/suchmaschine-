import express from 'express'

const app = express()
app.use(express.json({ limit: '2mb' }))

const PORT = Number(process.env.PORT || 3010)
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim()
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 35000)

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizePrice(raw) {
  if (raw == null || raw === '') return null
  const cleaned = String(raw)
    .replace(/CHF/gi, '')
    .replace(/inkl\..*$/i, '')
    .replace(/zzgl\..*$/i, '')
    .replace(/'/g, '')
    .replace(/–/g, '')
    .replace(/[^\d.,]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const value = Number.parseFloat(cleaned)
  return Number.isFinite(value) ? value : null
}

function clampText(value = '', max = 240) {
  const text = cleanText(value)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function compactHtml(html = '') {
  const raw = String(html || '')
  return raw
    .replace(/<script\b(?!(?=[^>]*application\/ld\+json))[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 40000)
}

function cleanUrl(url = '') {
  const value = String(url || '').trim()
  return /^https?:\/\//i.test(value) ? value : null
}

function normalizeExtractedOffer(result = {}, fallback = {}) {
  const price = normalizePrice(result.price)
  const confidence = Number(result.confidence_score)
  return {
    title: clampText(result.title || fallback.title || '', 180),
    brand: clampText(result.brand || '', 80) || null,
    category: clampText(result.category || '', 80) || null,
    price,
    currency: cleanText(result.currency || fallback.currency || 'CHF') || 'CHF',
    availability: clampText(result.availability || '', 80) || null,
    image_url: cleanUrl(result.image_url),
    mpn: clampText(result.mpn || '', 80) || null,
    ean_gtin: clampText(result.ean_gtin || '', 80) || null,
    summary: clampText(result.summary || '', 240) || null,
    confidence_score: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.68,
  }
}

function normalizeMatchResult(result = {}, candidates = []) {
  const candidateIds = new Set(candidates.map((item) => String(item.id)))
  const pickedId = result.canonical_id != null ? String(result.canonical_id) : null
  const confidence = Number(result.confidence_score)
  return {
    canonical_id: pickedId && candidateIds.has(pickedId) ? pickedId : null,
    reason: clampText(result.reason || '', 220) || null,
    alias_text: clampText(result.alias_text || '', 120) || null,
    confidence_score: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.55,
  }
}

function normalizeRankResult(result = {}, items = []) {
  const allowed = new Set(items.map((item) => String(item.id)))
  const ids = Array.isArray(result.ranked_ids) ? result.ranked_ids.map((id) => String(id)).filter((id) => allowed.has(id)) : []
  return {
    ranked_ids: [...new Set(ids)],
    summary: clampText(result.summary || '', 220) || null,
  }
}

function normalizePlanResult(result = {}) {
  const phrases = Array.isArray(result.search_terms) ? result.search_terms.map((term) => cleanText(term)).filter(Boolean) : []
  return {
    search_terms: [...new Set(phrases)].slice(0, 10),
    notes: clampText(result.notes || '', 220) || null,
  }
}

async function callOpenAIJson({ system, user, temperature = 0.1 }) {
  if (!OPENAI_API_KEY) {
    const err = new Error('OPENAI_API_KEY fehlt')
    err.status = 503
    throw err
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI HTTP ${response.status}`
      const err = new Error(message)
      err.status = response.status
      throw err
    }

    const content = payload?.choices?.[0]?.message?.content
    if (!content) throw new Error('Leere OpenAI-Antwort')
    return JSON.parse(content)
  } finally {
    clearTimeout(timeout)
  }
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ai_service',
    model: AI_MODEL,
    aiReady: !!OPENAI_API_KEY,
    mode: OPENAI_API_KEY ? 'live_ai' : 'disabled',
  })
})

app.post('/evaluate', (req, res) => {
  const score = Number(req.body?.deal_score || 0)
  const evaluation = score >= 88
    ? { label: 'Jetzt kaufen', verdict: 'buy' }
    : score >= 78
      ? { label: 'Guter Kauf', verdict: 'consider' }
      : { label: 'Beobachten', verdict: 'watch' }
  res.json({ ok: true, evaluation })
})

app.post('/extract', async (req, res) => {
  try {
    const url = cleanUrl(req.body?.url) || null
    const html = compactHtml(req.body?.html || '')
    const query = cleanText(req.body?.query || '')
    const titleHint = cleanText(req.body?.titleHint || '')
    const fallbackCurrency = cleanText(req.body?.currency || 'CHF') || 'CHF'

    if (!html) return res.status(400).json({ ok: false, error: 'html fehlt' })

    const system = [
      'Du extrahierst präzise Produktdaten für einen Schweizer Preisvergleich.',
      'Antworte nur als JSON.',
      'Wenn ein Feld nicht klar erkennbar ist, nutze null.',
      'Nutze nur Informationen, die aus HTML oder URL ableitbar sind.',
      'Wähle echte Produktdaten, keine Kategorien oder Shoptexte.',
    ].join(' ')

    const user = JSON.stringify({
      task: 'Extrahiere ein einzelnes kaufbares Produkt aus dieser HTML-Seite.',
      target_schema: {
        title: 'string',
        brand: 'string|null',
        category: 'string|null',
        price: 'number|null',
        currency: 'string|null',
        availability: 'string|null',
        image_url: 'string|null',
        mpn: 'string|null',
        ean_gtin: 'string|null',
        summary: 'string|null',
        confidence_score: 'number 0..1',
      },
      context: {
        url,
        query,
        titleHint,
        preferredCurrency: fallbackCurrency,
      },
      html,
    })

    const raw = await callOpenAIJson({ system, user, temperature: 0.05 })
    const extracted = normalizeExtractedOffer(raw, { title: titleHint, currency: fallbackCurrency })

    if (!extracted.title) {
      return res.json({ ok: true, extracted: null, reason: 'no_product_detected' })
    }

    res.json({ ok: true, extracted })
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: String(err.message || err) })
  }
})

app.post('/match', async (req, res) => {
  try {
    const offer = req.body?.offer || {}
    const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates.slice(0, 20) : []
    if (!cleanText(offer.title || '')) return res.status(400).json({ ok: false, error: 'offer.title fehlt' })
    if (!candidates.length) return res.json({ ok: true, match: { canonical_id: null, reason: 'no_candidates', confidence_score: 0 } })

    const system = [
      'Du entscheidest, ob ein Shop-Angebot zu einem bestehenden kanonischen Produkt gehört.',
      'Antworte nur als JSON.',
      'Wähle nur dann eine canonical_id, wenn Modell, Speichervariante und Produktfamilie wirklich zusammenpassen.',
      'Bei Unsicherheit gib canonical_id=null zurück.',
    ].join(' ')

    const user = JSON.stringify({
      task: 'Ordne das Offer höchstens einem Kandidaten zu.',
      target_schema: {
        canonical_id: 'string|null',
        reason: 'string|null',
        alias_text: 'string|null',
        confidence_score: 'number 0..1',
      },
      offer,
      candidates,
    })

    const raw = await callOpenAIJson({ system, user, temperature: 0.0 })
    res.json({ ok: true, match: normalizeMatchResult(raw, candidates) })
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: String(err.message || err) })
  }
})

app.post('/rank', async (req, res) => {
  try {
    const query = cleanText(req.body?.query || '')
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 30) : []
    if (!query) return res.status(400).json({ ok: false, error: 'query fehlt' })
    if (!items.length) return res.json({ ok: true, ranking: { ranked_ids: [], summary: null } })

    const system = [
      'Du rankst Produktresultate für einen Schweizer Produktvergleich.',
      'Antworte nur als JSON.',
      'Bevorzuge genaue Modelltreffer, Schweizer Relevanz, gute Preise und mehrere aktive Shops.',
    ].join(' ')

    const user = JSON.stringify({
      task: 'Ordne die Resultate nach Relevanz und Kaufnutzen.',
      target_schema: {
        ranked_ids: 'string[]',
        summary: 'string|null',
      },
      query,
      items,
    })

    const raw = await callOpenAIJson({ system, user, temperature: 0.05 })
    res.json({ ok: true, ranking: normalizeRankResult(raw, items) })
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: String(err.message || err) })
  }
})

app.post('/search-plan', async (req, res) => {
  try {
    const query = cleanText(req.body?.query || '')
    const swissSources = Array.isArray(req.body?.sources) ? req.body.sources.slice(0, 20) : []
    if (!query) return res.status(400).json({ ok: false, error: 'query fehlt' })

    const system = [
      'Du planst Suchphrasen für eine Schweizer AI-Produktsuche.',
      'Antworte nur als JSON.',
      'Nutze suchstarke, schweizspezifische und produktnahe Formulierungen.',
    ].join(' ')

    const user = JSON.stringify({
      task: 'Erzeuge fokussierte Suchphrasen für Produktdiscovery.',
      target_schema: {
        search_terms: 'string[]',
        notes: 'string|null',
      },
      query,
      swissSources,
    })

    const raw = await callOpenAIJson({ system, user, temperature: 0.15 })
    res.json({ ok: true, plan: normalizePlanResult(raw) })
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: String(err.message || err) })
  }
})

app.listen(PORT, () => {
  console.log(`ai service on ${PORT}`)
})
