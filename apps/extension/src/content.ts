function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function queryText(selectors: string[]) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = normalizeText(element?.textContent);
    if (text) return text;
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

  return queryText(['h1']) || normalizeText(document.title);
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

  return '';
}

function inferRoleUrl() {
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
