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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    parsed.hash = '';
    parsed.search = '';

    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '').replace(/\/+/g, '/');

    return `${hostname}${pathname}` || hostname;
  } catch {
    return normalizeWhitespace(
      trimmed
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('#')[0]
        .split('?')[0]
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
