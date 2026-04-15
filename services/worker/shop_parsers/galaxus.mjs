import { parseAnchorCandidates, parseContainerCandidates, parseJsonProductCandidates, rankCandidates } from './shared.mjs'

export function parseGalaxusCards(html = '', pageUrl = '', query = '') {
  return rankCandidates([
    ...parseJsonProductCandidates(html, pageUrl, query, 'galaxus'),
    ...parseContainerCandidates(html, pageUrl, query, 'galaxus'),
    ...parseAnchorCandidates(html, pageUrl, query, 'galaxus'),
  ]).slice(0, 24)
}
