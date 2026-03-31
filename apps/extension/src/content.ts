function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function sanitizePossibleCode(value: string) {
  const text = normalizeText(value);
  if (!text) return '';

  const codeIndicators = [
    'import(',
    'document.currentScript',
    'Promise.all([',
    'kit.start(',
    'function ',
    ' => {',
  ];

  if (codeIndicators.some((token) => text.includes(token))) return '';
  if (text.length > 200 && /[{}`;]/.test(text)) return '';

  return text;
}

function queryText(selectors: string[]) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = normalizeText(element?.textContent);
    if (text) return text;
  }
  return '';
}

function splitLabelValue(text: string) {
  const normalized = normalizeText(text);
  const separators = [':', '\n', ' - ', ' | '];

  for (const separator of separators) {
    const idx = normalized.toLowerCase().indexOf(separator.trim().toLowerCase());
    if (idx === -1) continue;

    if (separator === '\n') {
      const parts = normalized.split('\n').map((part) => normalizeText(part)).filter(Boolean);
      if (parts.length >= 2) {
        return {
          label: parts[0].toLowerCase(),
          value: parts.slice(1).join(' '),
        };
      }
      continue;
    }

    const parts = normalized.split(separator);
    if (parts.length >= 2) {
      return {
        label: normalizeText(parts[0]).toLowerCase(),
        value: normalizeText(parts.slice(1).join(separator)),
      };
    }
  }

  return null;
}

function findLabeledValue(possibleLabels: string[]) {
  const labels = possibleLabels.map((label) => label.toLowerCase());
  const selector = [
    '[data-testid]',
    '[data-test]',
    '[data-qa]',
    '[data-role]',
    '[aria-label]',
    '[class]',
    '[id]',
    'dt',
    'th',
    'label',
    'strong',
    'b',
    'span',
    'div',
    'li',
    'p',
  ].join(',');

  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));

  for (const element of elements) {
    const joinedMetadata = [
      element.id,
      element.className,
      element.getAttribute('data-testid'),
      element.getAttribute('data-test'),
      element.getAttribute('data-qa'),
      element.getAttribute('data-role'),
      element.getAttribute('aria-label'),
      element.getAttribute('name'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (labels.some((label) => joinedMetadata.includes(label.replace(/\s+/g, '_')) || joinedMetadata.includes(label.replace(/\s+/g, '-')) || joinedMetadata.includes(label))) {
      const ownText = normalizeText(element.textContent);
      const pair = splitLabelValue(ownText);
      if (pair && labels.some((label) => pair.label.includes(label))) {
        return pair.value;
      }

      const siblingText = normalizeText(element.nextElementSibling?.textContent);
      if (siblingText) return siblingText;

      const parentText = normalizeText(element.parentElement?.textContent);
      const parentPair = splitLabelValue(parentText);
      if (parentPair && labels.some((label) => parentPair.label.includes(label))) {
        return parentPair.value;
      }

      if (ownText && !labels.some((label) => ownText.toLowerCase() === label)) {
        return ownText;
      }
    }
  }

  const textNodes = Array.from(document.querySelectorAll<HTMLElement>('dt, th, label, strong, b, span, div, li, p'));
  for (const element of textNodes) {
    const text = normalizeText(element.textContent);
    const lower = text.toLowerCase();
    if (!labels.some((label) => lower.startsWith(label))) continue;

    const pair = splitLabelValue(text);
    if (pair && labels.some((label) => pair.label.includes(label))) {
      return pair.value;
    }

    const siblingText = normalizeText(element.nextElementSibling?.textContent);
    if (siblingText) return siblingText;
  }

  return '';
}

function hostnameLabel() {
  const hostname = window.location.hostname.replace(/^www\./, '');
  if (hostname.includes('apple.com')) return 'Apple';
  if (hostname.includes('linkedin.com')) return 'LinkedIn';
  if (hostname.includes('indeed.com')) return 'Indeed';
  return hostname.split('.')[0]?.replace(/[-_]/g, ' ') ?? '';
}

function inferTitle() {
  const host = window.location.hostname;

  if (host.includes('apple.com')) {
    return (
      queryText([
        '#jobdetails-postingtitle',
        '[data-test-id="job-title"]',
        'h1',
      ]) ||
      normalizeText(document.title.replace(/\s*-\s*Careers at Apple.*$/i, ''))
    );
  }

  if (host.includes('linkedin.com')) {
    return queryText([
      '.job-details-jobs-unified-top-card__job-title',
      '.t-24.job-details-jobs-unified-top-card__job-title',
      'h1',
    ]) || normalizeText(document.title);
  }

  if (host.includes('indeed.com')) {
    return queryText([
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1',
    ]) || normalizeText(document.title);
  }

  if (host.includes('amazon.jobs')) {
    const amazonTitle =
      queryText([
        'h1',
      ]) ||
      normalizeText(
        document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? ''
      );
    if (amazonTitle) return amazonTitle;
  }

  if (host.includes('zipline.com')) {
    const zipTitle =
      queryText([
        'h1',
        '[data-testid="job-title"]',
        '[data-component="job-title"]',
      ]) ||
      normalizeText(
        document.title.replace(/^Open Roles\s*\|\s*/i, '')
      );
    return zipTitle;
  }

  return (
    findLabeledValue(['job_title', 'job title', 'role']) ||
    queryText(['h1']) ||
    normalizeText(document.title)
  );
}

function inferCompany() {
  const host = window.location.hostname;

  if (host.includes('apple.com')) {
    return queryText([
      '[data-test-id="job-team-name"]',
      '.job-details .formrow .value',
      'meta[property="og:site_name"]',
    ]) || 'Apple';
  }

  if (host.includes('linkedin.com')) {
    return queryText([
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
    ]);
  }

  if (host.includes('indeed.com')) {
    return queryText([
      '[data-testid="inlineHeader-companyName"]',
      '[data-company-name="true"]',
    ]);
  }

  return hostnameLabel();
}

function inferLocation() {
  const host = window.location.hostname;

  if (host.includes('apple.com')) {
    return queryText([
      '[data-test-id="job-location-name"]',
      '.job-location',
      '.table-col-2',
    ]);
  }

  if (host.includes('linkedin.com')) {
    return queryText([
      '.job-details-jobs-unified-top-card__primary-description-container span',
      '.tvm__text.tvm__text--low-emphasis',
    ]);
  }

  if (host.includes('indeed.com')) {
    return queryText([
      '[data-testid="job-location"]',
      '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
    ]);
  }

  const generic = findLabeledValue(['job_location', 'job location', 'location', 'office_location', 'office location']);
  return sanitizePossibleCode(generic);
}

function inferRoleUrl() {
  const host = window.location.hostname;

  // Some sites (like Zipline) use a generic canonical/og:url for all job pages.
  // For those, prefer the actual browser URL so we keep the specific job id.
  if (host.includes('zipline.com')) {
    return window.location.href;
  }

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content;
  return canonical || ogUrl || window.location.href;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'BLIP_CAPTURE_CONTEXT') return;

  const capture = {
    selectionText: normalizeText(message.selectionText),
    pageUrl: window.location.href,
    pageTitle: normalizeText(document.title),
    roleUrl: inferRoleUrl(),
    jobTitle: inferTitle(),
    company: inferCompany(),
    location: inferLocation(),
    rawCapture: {
      source: 'dom',
      hostname: window.location.hostname,
      capturedAt: new Date().toISOString(),
      hasSelection: Boolean(normalizeText(message.selectionText)),
    },
  };

  sendResponse({ ok: true, capture });
  return true;
});
