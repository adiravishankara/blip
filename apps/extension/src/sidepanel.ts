import { getPendingCapture, setPendingCapture } from './lib/storage';
import { createJobFromCapture, getBlipWebUrl, matchResumeForJob, supabase } from './lib/supabase';
import type { MatchResponse, PendingCaptureState } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const authForm = document.querySelector<HTMLDivElement>('#auth-form')!;
const signedInPanel = document.querySelector<HTMLDivElement>('#signed-in-panel')!;
const accountActions = document.querySelector<HTMLDivElement>('#account-actions')!;
const signInButton = document.querySelector<HTMLButtonElement>('#sign-in-btn')!;
const signOutButton = document.querySelector<HTMLButtonElement>('#sign-out-btn')!;
const openProfileButton = document.querySelector<HTMLButtonElement>('#open-profile-btn')!;
const openAppButton = document.querySelector<HTMLButtonElement>('#open-app-btn')!;
const openSettingsButton = document.querySelector<HTMLButtonElement>('#open-settings-btn')!;
const emailInput = document.querySelector<HTMLInputElement>('#email')!;
const passwordInput = document.querySelector<HTMLInputElement>('#password')!;
const authStatus = document.querySelector<HTMLDivElement>('#auth-status')!;
const accountCopy = document.querySelector<HTMLDivElement>('#account-copy')!;
const accountPill = document.querySelector<HTMLSpanElement>('#account-pill')!;
const accountAvatar = document.querySelector<HTMLDivElement>('#account-avatar')!;
const accountEmailFull = document.querySelector<HTMLDivElement>('#account-email-full')!;
const supabaseConnection = document.querySelector<HTMLDivElement>('#supabase-connection')!;
const supabaseConnectionDetail = document.querySelector<HTMLDivElement>('#supabase-connection-detail')!;
const capturePill = document.querySelector<HTMLSpanElement>('#capture-pill')!;
const captureBody = document.querySelector<HTMLDivElement>('#capture-body')!;

let processingCaptureId: string | null = null;

function setStatus(element: HTMLElement, message: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  element.textContent = message;
  element.className = kind === 'neutral' ? 'status' : `status ${kind}`;
}

function pill(element: HTMLElement, label: string, tone: 'gray' | 'blue' | 'green' | 'red') {
  element.textContent = label;
  element.className = `pill ${tone}`;
}

function toggleVisibility(element: HTMLElement, visible: boolean) {
  element.dataset.hidden = visible ? 'false' : 'true';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inferSupabaseKind(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url) ? 'Local Supabase' : 'Cloud Supabase';
}

async function checkSupabaseConnection() {
  try {
    const { error } = await supabase.from('jobs').select('id').limit(1);

    if (error && !String(error.message).toLowerCase().includes('permission')) {
      supabaseConnection.textContent = 'Connection error';
      supabaseConnection.style.color = 'var(--rose)';
      supabaseConnectionDetail.textContent = `${inferSupabaseKind(supabaseUrl)} • ${error.message}`;
      return;
    }

    supabaseConnection.textContent = 'Connected';
    supabaseConnection.style.color = 'var(--emerald)';
    supabaseConnectionDetail.textContent = `${inferSupabaseKind(supabaseUrl)} • ${supabaseUrl}`;
  } catch (error) {
    supabaseConnection.textContent = 'Connection error';
    supabaseConnection.style.color = 'var(--rose)';
    supabaseConnectionDetail.textContent = `${inferSupabaseKind(supabaseUrl)} • ${error instanceof Error ? error.message : 'Connection failed'}`;
  }
}

function renderCapture(state: PendingCaptureState | null) {
  if (!state) {
    pill(capturePill, 'Idle', 'gray');
    captureBody.innerHTML = `
      <div class="empty">
        <div style="font-weight: 800; margin-bottom: 8px;">Nothing pending yet</div>
        <div class="muted">Highlight a job description on any supported page, right-click, and choose Blip from the context menu.</div>
      </div>
    `;
    return;
  }

  if (state.status === 'pending') pill(capturePill, 'Queued', 'blue');
  if (state.status === 'processing') pill(capturePill, 'Processing', 'blue');
  if (state.status === 'ready') pill(capturePill, 'Ready', 'green');
  if (state.status === 'error') pill(capturePill, 'Error', 'red');

  const { capture } = state;
  const selectionPreview = capture.selectionText || 'No highlighted text was captured.';
  const resultsMarkup = state.matchResults?.length
    ? `
      <div class="card" style="padding: 0; border: 0; box-shadow: none; margin-bottom: 0;">
        <h3 style="margin-bottom: 10px;">Top Resume Matches</h3>
        <div class="results">
          ${state.matchResults.slice(0, 5).map((result) => `
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
    `
    : state.status === 'ready'
      ? `
        <div class="field">
          <div class="field-label">Resume State</div>
          <div class="field-value">
            ${
              state.resumeState === 'empty'
                ? 'No resume versions are uploaded yet.'
                : state.resumeState === 'processing'
                  ? 'Your resume uploads are still processing.'
                  : 'No ranked resumes were returned.'
            }
          </div>
        </div>
      `
      : '';

  const actionsMarkup = state.jobId
    ? `
      <div class="actions">
        <button id="open-blip-btn" class="primary">Open Blip</button>
        <a class="link" href="${escapeHtml(capture.pageUrl)}" target="_blank" rel="noreferrer">Open source page</a>
      </div>
    `
    : '';

  captureBody.innerHTML = `
    ${state.error ? `<div class="field" style="border-color: #f0c6c6; background: #fff7f7;"><div class="field-value" style="color: var(--rose);">${escapeHtml(state.error)}</div></div>` : ''}
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
    </div>
    ${resultsMarkup}
    ${actionsMarkup}
  `;

  const openBlipButton = document.querySelector<HTMLButtonElement>('#open-blip-btn');
  if (openBlipButton) {
    openBlipButton.addEventListener('click', () => {
      chrome.tabs.create({ url: getBlipWebUrl() });
    });
  }
}

async function refreshAccount() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  toggleVisibility(authForm, !user);
  toggleVisibility(signedInPanel, Boolean(user));
  accountCopy.textContent = user?.email ?? 'Sign in once and Blip will process captures automatically.';
  pill(accountPill, user ? 'Signed in' : 'Signed out', user ? 'green' : 'gray');
  accountAvatar.textContent = (user?.email?.[0] ?? 'B').toUpperCase();
  accountEmailFull.textContent = user?.email ?? '';
  await checkSupabaseConnection();
  return user;
}

async function processPendingCapture() {
  const user = await refreshAccount();
  const state = await getPendingCapture();
  renderCapture(state);

  if (!state || state.status !== 'pending') return;
  if (!user) return;
  if (processingCaptureId === state.capture.id) return;

  processingCaptureId = state.capture.id;
  await setPendingCapture({ ...state, status: 'processing', error: undefined });
  renderCapture(await getPendingCapture());

  try {
    const createdJob = await createJobFromCapture(state.capture);
    const match = await matchResumeForJob(createdJob.id);

    await setPendingCapture({
      status: 'ready',
      capture: state.capture,
      jobId: createdJob.id,
      matchResults: match.results,
      resumeState: match.resume_state,
    });
  } catch (error) {
    await setPendingCapture({
      ...state,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to save this capture to Blip.',
    });
  } finally {
    processingCaptureId = null;
    renderCapture(await getPendingCapture());
  }
}

signInButton.addEventListener('click', async () => {
  setStatus(authStatus, '');
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });
    if (error) throw error;

    passwordInput.value = '';
    setStatus(authStatus, 'Signed in. Processing the current capture now.', 'good');
    await processPendingCapture();
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : 'Could not sign in.', 'bad');
  }
});

signOutButton.addEventListener('click', async () => {
  setStatus(authStatus, '');
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await refreshAccount();
    setStatus(authStatus, 'Signed out.', 'good');
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : 'Could not sign out.', 'bad');
  }
});

openAppButton.addEventListener('click', () => {
  chrome.tabs.create({ url: getBlipWebUrl() });
});

openProfileButton.addEventListener('click', () => {
  chrome.tabs.create({ url: `${getBlipWebUrl()}?profile=1` });
});

openSettingsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local' || !changes['blip.pendingCapture']) return;
  await processPendingCapture();
});

supabase.auth.onAuthStateChange(() => {
  void processPendingCapture();
});

void processPendingCapture();
