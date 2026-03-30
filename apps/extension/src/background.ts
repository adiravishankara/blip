chrome.runtime.onInstalled.addListener(() => {
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
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId !== 'blip-add' && info.menuItemId !== 'blip-compare') return;

  const selectionText = info.selectionText ?? '';

  await chrome.tabs.sendMessage(tab.id, {
    type: 'BLIP_SELECTION',
    selectionText,
    pageUrl: tab.url ?? '',
    action: info.menuItemId === 'blip-add' ? 'add' : 'compare',
  });
});

