import { parseAnchorCandidates, parseContainerCandidates, rankCandidates } from './shared.mjs'

export function parseAlternateCards(html = '', pageUrl = '', query = '') {
  return rankCandidates([
    ...parseContainerCandidates(html, pageUrl, query, 'alternate_ch'),
    ...parseAnchorCandidates(html, pageUrl, query, 'alternate_ch'),
  ]).slice(0, 24)
}
