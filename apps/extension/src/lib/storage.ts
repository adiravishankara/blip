import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants';
import type { ExtensionSettings, PendingCaptureState } from '../types';

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.settings);
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[STORAGE_KEYS.settings] ?? {}),
  };
}

export async function setSettings(settings: ExtensionSettings) {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.settings]: settings,
  });
}

export async function getPendingCapture(): Promise<PendingCaptureState | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.pendingCapture);
  return (stored[STORAGE_KEYS.pendingCapture] ?? null) as PendingCaptureState | null;
}

export async function setPendingCapture(state: PendingCaptureState) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.pendingCapture]: state,
  });
}
