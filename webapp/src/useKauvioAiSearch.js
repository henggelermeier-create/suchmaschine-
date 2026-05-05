import { useCallback, useEffect, useRef, useState } from 'react';
import { searchKauvioAiProducts } from './kauvioAiSearchClient.js';

export function useKauvioAiSearch(initialQuery = '', options = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState({
    ok: false,
    products: [],
    advisor: null,
    intent: null,
    search_plan: null,
    meta: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const runSearch = useCallback(async (nextQuery = query, overrideOptions = {}) => {
    const normalized = String(nextQuery ?? '').trim();
    setQuery(normalized);

    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!normalized) {
      setResult({ ok: false, products: [], advisor: null, intent: null, search_plan: null, meta: null });
      setError(null);
      setLoading(false);
      return null;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const payload = await searchKauvioAiProducts(normalized, {
        ...options,
        ...overrideOptions,
        signal: controller.signal,
      });

      if (!payload.ok) {
        setError(payload.error ?? 'Kauvio AI Suche fehlgeschlagen.');
      }

      setResult(payload);
      return payload;
    } catch (searchError) {
      if (searchError?.name === 'AbortError') return null;
      const message = searchError?.message ?? 'Kauvio AI Suche fehlgeschlagen.';
      setError(message);
      setResult({ ok: false, products: [], advisor: null, intent: null, search_plan: null, meta: null });
      return null;
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [query, options]);

  useEffect(() => () => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return {
    query,
    setQuery,
    result,
    products: result.products ?? [],
    advisor: result.advisor,
    intent: result.intent,
    searchPlan: result.search_plan,
    meta: result.meta,
    loading,
    error,
    runSearch,
  };
}

export default useKauvioAiSearch;
