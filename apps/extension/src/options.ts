import { getSettings, setSettings } from './lib/storage';
import { supabase } from './lib/supabase';

const emailInput = document.querySelector<HTMLInputElement>('#email')!;
const passwordInput = document.querySelector<HTMLInputElement>('#password')!;
const signInButton = document.querySelector<HTMLButtonElement>('#sign-in-btn')!;
const signOutButton = document.querySelector<HTMLButtonElement>('#sign-out-btn')!;
const authStatus = document.querySelector<HTMLDivElement>('#auth-status')!;
const signedOutView = document.querySelector<HTMLDivElement>('#signed-out-view')!;
const signedInView = document.querySelector<HTMLDivElement>('#signed-in-view')!;
const accountEmail = document.querySelector<HTMLDivElement>('#account-email')!;
const selectionRequired = document.querySelector<HTMLInputElement>('#selection-required')!;
const saveSettingsButton = document.querySelector<HTMLButtonElement>('#save-settings-btn')!;
const settingsStatus = document.querySelector<HTMLSpanElement>('#settings-status')!;

function setStatus(element: HTMLElement, message: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  element.textContent = message;
  element.className = kind === 'neutral' ? 'status' : `status ${kind}`;
}

async function refreshAuthView() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  signedOutView.hidden = Boolean(user);
  signedInView.hidden = !user;
  accountEmail.textContent = user?.email ?? '';
}

async function init() {
  const settings = await getSettings();
  selectionRequired.checked = settings.selectionRequired;
  await refreshAuthView();
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
    setStatus(authStatus, 'Signed in successfully.', 'good');
    await refreshAuthView();
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : 'Could not sign in.', 'bad');
  }
});

signOutButton.addEventListener('click', async () => {
  setStatus(authStatus, '');
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setStatus(authStatus, 'Signed out.', 'good');
    await refreshAuthView();
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : 'Could not sign out.', 'bad');
  }
});

saveSettingsButton.addEventListener('click', async () => {
  await setSettings({
    selectionRequired: selectionRequired.checked,
  });

  setStatus(settingsStatus, 'Saved.', 'good');
  window.setTimeout(() => setStatus(settingsStatus, ''), 2000);
});

void init();
