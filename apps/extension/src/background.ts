import { getSettings, setPendingCapture } from './lib/storage';
import type { CaptureAction, ContentCaptureResponse, PendingCaptureState } from './types';

function isSupportedCaptureUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

async function ensureMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: 'blip-add',
    title: 'Add to Blip',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'blip-compare',
    title: 'Compare with Blip',
    contexts: ['selection'],
  });
}

async function openPanel(tabId: number) {
  await chrome.sidePanel.setOptions({
    tabId,
    path: 'src/sidepanel.html',
    enabled: true,
  });
  await chrome.sidePanel.open({ tabId });
}

async function captureFromTab(tabId: number, selectionText: string, action: CaptureAction) {
  const message = {
    type: 'BLIP_CAPTURE_CONTEXT',
    selectionText,
    action,
  } as const;

  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as ContentCaptureResponse | undefined;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const missingReceiver =
      errorMessage.includes('Receiving end does not exist') ||
      errorMessage.includes('Could not establish connection');

    if (!missingReceiver) throw error;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['assets/content.js'],
    });

    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as ContentCaptureResponse | undefined;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureMenus();
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onStartup?.addListener(async () => {
  await ensureMenus();
});

void ensureMenus();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.url) return;

  const action: CaptureAction | null =
    info.menuItemId === 'blip-add' ? 'add'
    : info.menuItemId === 'blip-compare' ? 'compare'
    : null;

  if (!action) return;

  if (!isSupportedCaptureUrl(tab.url)) {
    await setPendingCapture({
      status: 'error',
      capture: {
        id: crypto.randomUUID(),
        action,
        selectionText: (info.selectionText ?? '').trim(),
        pageUrl: tab.url,
        pageTitle: tab.title ?? '',
        roleUrl: tab.url,
        jobTitle: tab.title ?? 'Untitled Role',
        company: '',
        location: '',
        rawCapture: { reason: 'unsupported_url' },
        createdAt: new Date().toISOString(),
      },
      error: 'Blip only works on standard http/https pages.',
    });
    await openPanel(tab.id);
    return;
  }

  const settings = await getSettings();
  const selectedText = (info.selectionText ?? '').trim();

  if (settings.selectionRequired && !selectedText) {
    await setPendingCapture({
      status: 'error',
      capture: {
        id: crypto.randomUUID(),
        action,
        selectionText: '',
        pageUrl: tab.url,
        pageTitle: tab.title ?? '',
        roleUrl: tab.url,
        jobTitle: tab.title ?? 'Untitled Role',
        company: '',
        location: '',
        rawCapture: { reason: 'selection_required' },
        createdAt: new Date().toISOString(),
      },
      error: 'Highlight the job description before using Blip on this page.',
    });
    await openPanel(tab.id);
    return;
  }

  try {
    const response = await captureFromTab(tab.id, selectedText, action);
    if (!response?.ok) throw new Error('Could not capture page context.');

    const pendingState: PendingCaptureState = {
      status: 'pending',
      capture: {
        id: crypto.randomUUID(),
        action,
        createdAt: new Date().toISOString(),
        ...response.capture,
      },
    };

    await setPendingCapture(pendingState);
    await openPanel(tab.id);
  } catch (error) {
    await setPendingCapture({
      status: 'error',
      capture: {
        id: crypto.randomUUID(),
        action,
        selectionText: selectedText,
        pageUrl: tab.url,
        pageTitle: tab.title ?? '',
        roleUrl: tab.url,
        jobTitle: tab.title ?? 'Untitled Role',
        company: '',
        location: '',
        rawCapture: { reason: 'capture_failed' },
        createdAt: new Date().toISOString(),
      },
      error: error instanceof Error ? error.message : 'Failed to capture this page.',
    });
    await openPanel(tab.id);
  }
});
