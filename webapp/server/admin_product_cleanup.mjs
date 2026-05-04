export function registerAdminProductCleanupRoutes(app, { pool, auth, logAiRuntimeEvent }) {
  app.delete('/api/admin/products/:canonicalId', auth, async (req, res) => {
    const canonicalId = Number(req.params.canonicalId)
    if (!Number.isFinite(canonicalId)) return res.status(400).json({ error: 'Ungültige Produkt-ID.' })
    const reason = String(req.body?.reason || req.query?.reason || 'Manuell im Backend gelöscht/gesperrt.').trim()

    const result = await pool.query(`
      UPDATE canonical_products
      SET is_hidden = TRUE,
          hidden_reason = $2,
          hidden_at = NOW(),
          updated_at = NOW(),
          popularity_score = 0,
          freshness_priority = 0
      WHERE id = $1
      RETURNING id, title, is_hidden, hidden_reason
    `, [canonicalId, reason])

    await pool.query(`
      UPDATE source_offers_v2
      SET is_hidden = TRUE,
          hidden_reason = $2,
          is_active = FALSE,
          updated_at = NOW()
      WHERE canonical_product_id = $1
    `, [canonicalId, reason]).catch(() => {})

    if (!result.rows.length) return res.status(404).json({ error: 'Produkt nicht gefunden.' })
    await logAiRuntimeEvent?.('admin_product_hidden', null, 'warning', { canonicalId, reason }, req.user?.email || 'admin')
    res.json({ ok: true, item: result.rows[0] })
  })

  app.delete('/api/admin/offers/:offerId', auth, async (req, res) => {
    const offerId = Number(req.params.offerId)
    if (!Number.isFinite(offerId)) return res.status(400).json({ error: 'Ungültige Angebots-ID.' })
    const reason = String(req.body?.reason || req.query?.reason || 'Manuell im Backend gelöscht/gesperrt.').trim()

    const result = await pool.query(`
      UPDATE source_offers_v2
      SET is_hidden = TRUE,
          hidden_reason = $2,
          is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, canonical_product_id, provider, offer_title, is_hidden, hidden_reason
    `, [offerId, reason])

    if (!result.rows.length) return res.status(404).json({ error: 'Angebot nicht gefunden.' })
    await logAiRuntimeEvent?.('admin_offer_hidden', null, 'warning', { offerId, reason }, req.user?.email || 'admin')
    res.json({ ok: true, item: result.rows[0] })
  })
}
