import { getPendingCapture } from './lib/storage';
import { STORAGE_KEYS } from './lib/constants';
import { supabase, getBlipWebUrl, createJobFromCapture, matchResumeForJob } from './lib/supabase';
import type { MatchResult, PendingCaptureState } from './types';

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AppState {
  authStatus: AuthStatus;
  userEmail: string | null;
  capture: PendingCaptureState | null;
  isCreatingJob: boolean;
  isMatching: boolean;
}

const appRoot = document.querySelector<HTMLDivElement>('#app-root')!;
const profileTrigger = document.querySelector<HTMLButtonElement>('#profile-trigger')!;
const profileMenu = document.querySelector<HTMLDivElement>('#profile-menu')!;
const profileOpenWeb = document.querySelector<HTMLButtonElement>('#profile-open-web')!;
const profileOpenSettings = document.querySelector<HTMLButtonElement>('#profile-open-settings')!;
const profileLogout = document.querySelector<HTMLButtonElement>('#profile-logout')!;

const state: AppState = {
  authStatus: 'loading',
  userEmail: null,
  capture: null,
  isCreatingJob: false,
  isMatching: false,
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setState(partial: Partial<AppState>) {
  Object.assign(state, partial);
  renderApp();
}

function statusPill(status: PendingCaptureState['status']) {
  if (status === 'pending') return '<span class="pill blue">Queued</span>';
  if (status === 'processing') return '<span class="pill blue">Processing</span>';
  if (status === 'ready') return '<span class="pill green">Ready</span>';
  if (status === 'error') return '<span class="pill red">Error</span>';
  return '<span class="pill gray">Idle</span>';
}

function renderAuthScreen() {
  const webUrl = getBlipWebUrl();
  appRoot.innerHTML = `
    <section class="card">
      <h2 style="margin-bottom: 6px;">Sign in to Blip</h2>
      <div class="muted" style="margin-bottom: 14px;">
        Use your Blip account to save roles and find matching resumes directly from this page.
      </div>
      <div class="stack">
        <label class="small">
          Email
          <input id="auth-email" type="email" placeholder="you@example.com" />
        </label>
        <label class="small">
          Password
          <input id="auth-password" type="password" placeholder="Password" />
        </label>
        <button id="auth-sign-in" class="primary" type="button">Sign in</button>
        <button id="open-web-auth" class="secondary" type="button">Open Blip in browser</button>
        <button id="refresh-auth" class="secondary" type="button">I have already signed in</button>
        <div id="auth-refresh-status" class="small"></div>
        <div class="small">
          This extension uses the same account as the Blip web app. You can sign in here or from the browser.
        </div>
      </div>
    </section>
  `;

  const emailInput = document.querySelector<HTMLInputElement>('#auth-email');
  const passwordInput = document.querySelector<HTMLInputElement>('#auth-password');
  const signInButton = document.querySelector<HTMLButtonElement>('#auth-sign-in');
  const openWebAuth = document.querySelector<HTMLButtonElement>('#open-web-auth');
  const refreshAuth = document.querySelector<HTMLButtonElement>('#refresh-auth');
  const refreshStatus = document.querySelector<HTMLDivElement>('#auth-refresh-status');

  signInButton?.addEventListener('click', async () => {
    if (!emailInput || !passwordInput || !refreshStatus) return;
    refreshStatus.textContent = '';
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      refreshStatus.textContent = 'Enter your email and password.';
      return;
    }
    refreshStatus.textContent = 'Signing in…';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      refreshStatus.textContent = error.message;
      return;
    }
    passwordInput.value = '';
    refreshStatus.textContent = 'Signed in. Loading account…';
    await hydrateAuth();
  });

  openWebAuth?.addEventListener('click', () => {
    chrome.tabs.create({ url: webUrl });
  });

  refreshAuth?.addEventListener('click', () => {
    void (async () => {
      if (refreshStatus) refreshStatus.textContent = 'Checking your Blip account...';
      const authenticated = await hydrateAuth();
      if (!authenticated && refreshStatus) {
        refreshStatus.textContent = 'Still not signed in. Make sure you have signed in from the Blip extension options or this panel.';
      }
    })();
  });
}

function renderMatches(results: MatchResult[] | undefined) {
  if (!results?.length) return '';
  return `
    <div class="card" style="padding: 0; border: 0; box-shadow: none; margin-bottom: 0;">
      <h3 style="margin-bottom: 10px;">Top Resume Matches</h3>
      <div class="results">
        ${results.slice(0, 5).map((result) => `
          <div class="result">
            <div class="row">
              <div style="font-weight: 800;">${escapeHtml(result.label)}</div>
              <div class="result-score">${Math.round(result.score)}%</div>
            </div>
            <div class="muted" style="margin-top: 6px;">
              Missing keywords: ${escapeHtml(result.missing_keywords.slice(0, 8).join(', ') || 'None')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCaptureSection() {
  const captureState = state.capture;
  if (!captureState) {
    return `
      <section class="card">
        <div class="row" style="margin-bottom: 12px;">
          <div>
            <h2>Role from this page</h2>
            <div class="muted">Highlight a job description and use “Add to Blip” to fill these fields.</div>
          </div>
          <span class="pill gray">Idle</span>
        </div>
        <div class="meta">
          <div class="field">
            <div class="field-label">Role</div>
            <div class="field-value muted">Waiting for capture…</div>
          </div>
          <div class="field">
            <div class="field-label">Company</div>
            <div class="field-value muted">Waiting for capture…</div>
          </div>
          <div class="field">
            <div class="field-label">Location</div>
            <div class="field-value muted">Waiting for capture…</div>
          </div>
          <div class="field">
            <div class="field-label">Role URL</div>
            <div class="field-value muted">Waiting for capture…</div>
          </div>
          <div class="field">
            <div class="field-label">Selected Description</div>
            <div class="field-value muted">Waiting for capture…</div>
          </div>
        </div>
      </section>
    `;
  }

  const { capture, status, error, matchResults, resumeState } = captureState;
  const selectionPreview = capture.selectionText || 'No highlighted text was captured.';

  const resumeStateMarkup = status === 'ready' && !matchResults?.length
    ? `
      <div class="field">
        <div class="field-label">Resume State</div>
        <div class="field-value">
          ${
            resumeState === 'empty'
              ? 'No resume versions are uploaded yet.'
              : resumeState === 'processing'
                ? 'Your resume uploads are still processing.'
                : 'No ranked resumes were returned.'
          }
        </div>
      </div>
    `
    : '';

  const errorMarkup = error
    ? `<div class="field" style="border-color: #f0c6c6; background: #fff7f7;"><div class="field-value" style="color: var(--rose);">${escapeHtml(error)}</div></div>`
    : '';

  const actionsMarkup = capture.action === 'add'
    ? `
      <div class="actions">
        <button id="create-job-btn" class="primary" type="button" ${state.isCreatingJob ? 'disabled' : ''}>
          ${state.isCreatingJob ? 'Saving…' : 'Save role to Blip'}
        </button>
        ${captureState.jobId ? `
          <button id="match-resume-btn" class="secondary" type="button" ${state.isMatching ? 'disabled' : ''}>
            ${state.isMatching ? 'Matching…' : 'Find matching resumes'}
          </button>
        ` : ''}
        <button id="clear-capture-btn" class="secondary" type="button">
          Clear role
        </button>
      </div>
    `
    : '';

  return `
    <section class="card">
      <div class="row" style="margin-bottom: 12px;">
        <div>
          <h2>Current Capture</h2>
          <div class="muted">Right-click on a highlighted job description to send a role into Blip.</div>
        </div>
        ${statusPill(status)}
      </div>
      ${errorMarkup}
      <div class="meta">
        <div class="field">
          <div class="field-label">Action</div>
          <div class="field-value">${capture.action === 'compare' ? 'Compare with Blip' : 'Add to Blip'}</div>
        </div>
        <div class="field">
          <div class="field-label">Role</div>
          <div class="field-value">${escapeHtml(capture.jobTitle || 'Untitled Role')}</div>
        </div>
        <div class="field">
          <div class="field-label">Company</div>
          <div class="field-value">${escapeHtml(capture.company || 'Unknown company')}</div>
        </div>
        <div class="field">
          <div class="field-label">Location</div>
          <div class="field-value">${escapeHtml(capture.location || 'Unknown')}</div>
        </div>
        <div class="field">
          <div class="field-label">Role URL</div>
          <div class="field-value">${escapeHtml(capture.roleUrl)}</div>
        </div>
        <div class="field">
          <div class="field-label">Selected Description</div>
          <div class="field-value">${escapeHtml(selectionPreview.slice(0, 1400))}</div>
        </div>
        ${resumeStateMarkup}
      </div>
      ${actionsMarkup}
      ${renderMatches(matchResults)}
    </section>
  `;
}

function renderMainScreen() {
  const captureSection = renderCaptureSection();

  appRoot.innerHTML = `
    <section class="card" style="margin-bottom: 12px;">
      <div class="row">
        <div>
          <h2>Roles in Blip</h2>
          <div class="muted">Save roles from the web and see how your resumes stack up.</div>
        </div>
      </div>
    </section>
    ${captureSection}
  `;

  const createJobBtn = document.querySelector<HTMLButtonElement>('#create-job-btn');
  const matchResumeBtn = document.querySelector<HTMLButtonElement>('#match-resume-btn');
  const clearCaptureBtn = document.querySelector<HTMLButtonElement>('#clear-capture-btn');

  createJobBtn?.addEventListener('click', () => {
    void handleCreateJobFromCapture();
  });

  matchResumeBtn?.addEventListener('click', () => {
    void handleMatchResume();
  });

  clearCaptureBtn?.addEventListener('click', () => {
    void handleClearCapture();
  });
}

function renderApp() {
  if (state.authStatus === 'loading') {
    appRoot.innerHTML = `
      <section class="card">
        <div class="small">Checking your Blip account…</div>
      </section>
    `;
    return;
  }

  if (state.authStatus === 'unauthenticated') {
    renderAuthScreen();
    return;
  }

  renderMainScreen();
}

async function hydrateAuth() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    setState({ authStatus: 'unauthenticated', userEmail: null });
    return false;
  }

  setState({ authStatus: 'authenticated', userEmail: session.user.email ?? null });
  return true;
}

async function hydrateCapture() {
  const pending = await getPendingCapture();
  setState({ capture: pending });
}

async function handleCreateJobFromCapture() {
  const captureState = state.capture;
  if (!captureState) return;

  try {
    setState({ isCreatingJob: true });
    const job = await createJobFromCapture(captureState.capture);
    setState({
      capture: {
        ...captureState,
        status: 'processing',
        jobId: job.id,
        error: undefined,
      },
      isCreatingJob: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save this role.';
    setState({
      capture: {
        ...captureState,
        status: 'error',
        error: message,
      },
      isCreatingJob: false,
    });
  }
}

async function handleMatchResume() {
  const captureState = state.capture;
  if (!captureState?.jobId) return;

  try {
    setState({ isMatching: true });
    const matchResponse = await matchResumeForJob(captureState.jobId);
    setState({
      capture: {
        ...captureState,
        status: 'ready',
        matchResults: matchResponse.results,
        resumeState: matchResponse.resume_state,
        error: undefined,
      },
      isMatching: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not match resumes for this role.';
    setState({
      capture: {
        ...captureState,
        status: 'error',
        error: message,
      },
      isMatching: false,
    });
  }
}

async function handleClearCapture() {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.pendingCapture);
  } catch {
    // If storage removal fails, still clear local state so UI resets.
  }
  setState({
    capture: null,
    isCreatingJob: false,
    isMatching: false,
  });
}

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local' || !changes['blip.pendingCapture']) return;
  await hydrateCapture();
});

profileTrigger.addEventListener('click', (event) => {
  event.stopPropagation();
  const isHidden = profileMenu.classList.contains('hidden');
  if (isHidden) {
    profileMenu.classList.remove('hidden');
  } else {
    profileMenu.classList.add('hidden');
  }
});

document.addEventListener('click', (event) => {
  if (!profileMenu.contains(event.target as Node) && event.target !== profileTrigger) {
    profileMenu.classList.add('hidden');
  }
});

profileOpenWeb.addEventListener('click', () => {
  chrome.tabs.create({ url: getBlipWebUrl() });
  profileMenu.classList.add('hidden');
});

profileOpenSettings.addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
  profileMenu.classList.add('hidden');
});

profileLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  setState({ authStatus: 'unauthenticated', userEmail: null, capture: null });
  profileMenu.classList.add('hidden');
});

void (async function init() {
  renderApp();
  await hydrateAuth();
  await hydrateCapture();
})();
