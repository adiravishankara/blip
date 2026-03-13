const COMPANY_SUFFIXES = new Set([
  'inc',
  'incorporated',
  'llc',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
]);

const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^msclkid$/i,
  /^mc_/i,
  /^mkt_/i,
  /^ref$/i,
  /^referrer$/i,
  /^referral$/i,
  /^source$/i,
  /^src$/i,
  /^gh_src$/i,
  /^icid$/i,
  /^yclid$/i,
  /^igshid$/i,
  /^pk_/i,
  /^_hs/i,
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isTrackingParam(key: string): boolean {
  return TRACKING_PARAM_PATTERNS.some(pattern => pattern.test(key));
}

export function sanitizeJobUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    parsed.hash = '';

    const nextParams = new URLSearchParams();
    Array.from(parsed.searchParams.entries())
      .filter(([key]) => !isTrackingParam(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => {
        nextParams.append(key, value);
      });

    parsed.search = nextParams.toString() ? `?${nextParams.toString()}` : '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '').replace(/\/+/g, '/');

    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function normalizeJobTitle(title: string): string {
  return normalizeWhitespace(title.toLowerCase().replace(/[^a-z0-9]+/g, ' '));
}

export function normalizeCompanyName(company: string): string {
  const normalized = normalizeWhitespace(company.toLowerCase().replace(/[^a-z0-9]+/g, ' '));
  const parts = normalized.split(' ').filter(Boolean);

  while (parts.length > 0 && COMPANY_SUFFIXES.has(parts[parts.length - 1])) {
    parts.pop();
  }

  return parts.join(' ');
}

export function normalizeJobUrl(url: string | null | undefined): string | null {
  const sanitized = sanitizeJobUrl(url);
  if (!sanitized) return null;

  try {
    const parsed = new URL(sanitized.startsWith('http') ? sanitized : `https://${sanitized}`);
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '').replace(/\/+/g, '/');

    const params = new URLSearchParams(parsed.search);
    const normalizedSearch = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return `${hostname}${pathname}${normalizedSearch ? `?${normalizedSearch}` : ''}` || hostname;
  } catch {
    return normalizeWhitespace(
      sanitized
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('#')[0]
        .replace(/\/+$/, '')
        .toLowerCase()
    ) || null;
  }
}

export function buildNormalizedJobFields(input: {
  company: string;
  job_title: string;
  job_url?: string | null;
}) {
  return {
    normalizedCompany: normalizeCompanyName(input.company),
    normalizedTitle: normalizeJobTitle(input.job_title),
    normalizedJobUrl: normalizeJobUrl(input.job_url),
  };
}
