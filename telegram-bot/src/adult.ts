import { readFileSync } from 'node:fs'

/**
 * Adult-site domains, shared with the python-service (generated from
 * python-service/sites_pack.py into shared/adult-domains.json). Used for the
 * per-user "Adult content" setting: off → adult links are refused and search
 * runs with SafeSearch on.
 */
function load(): string[] {
  try {
    const raw = readFileSync(new URL('../../shared/adult-domains.json', import.meta.url), 'utf8')
    const list = (JSON.parse(raw) as { domains?: unknown }).domains
    return Array.isArray(list) ? list.filter((d): d is string => typeof d === 'string') : []
  } catch (e) {
    console.warn(`[bot] adult domain list unavailable (${(e as Error).message}); adult filter matches nothing`)
    return []
  }
}

const DOMAINS = load()

export function isAdultUrl(url: string): boolean {
  let host: string
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return false
  }
  if (host.startsWith('www.')) host = host.slice(4)
  return DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}

export const adultDomainCount = DOMAINS.length
