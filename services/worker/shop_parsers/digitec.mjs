import { parseAnchorCandidates, parseContainerCandidates, parseJsonProductCandidates, rankCandidates } from './shared.mjs'

export function parseDigitecCards(html = '', pageUrl = '', query = '') {
  return rankCandidates([
    ...parseJsonProductCandidates(html, pageUrl, query, 'digitec'),
    ...parseContainerCandidates(html, pageUrl, query, 'digitec'),
    ...parseAnchorCandidates(html, pageUrl, query, 'digitec'),
  ]).slice(0, 24)
}
