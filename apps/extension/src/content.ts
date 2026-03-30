chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'BLIP_SELECTION') return;

  // Placeholder: actual extraction + Supabase call comes next.
  // For now, we just log so we can verify wiring quickly.
  console.log('[Blip] selection received', message);
});

