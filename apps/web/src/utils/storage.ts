import { supabase } from '../lib/supabase';

const FIRECRAWL_MODE_KEY = 'blip.firecrawl.mode';
const FIRECRAWL_CUSTOM_URL_KEY = 'blip.firecrawl.customUrl';
const FIRECRAWL_CLOUD_URL = 'https://api.firecrawl.dev/v2/scrape';

export type FirecrawlMode = 'cloud' | 'custom';

export interface FirecrawlConfig {
  mode: FirecrawlMode;
  customUrl: string;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function resolveResumeUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;

  const { data } = supabase.storage
    .from('resumes')
    .getPublicUrl(url);

  return data.publicUrl;
}

export function getDefaultFirecrawlCustomUrl(): string {
  return import.meta.env.VITE_FIRECRAWL_API_URL || '';
}

export function getFirecrawlConfig(): FirecrawlConfig {
  if (!canUseStorage()) {
    return {
      mode: 'cloud',
      customUrl: getDefaultFirecrawlCustomUrl(),
    };
  }

  const mode = (window.localStorage.getItem(FIRECRAWL_MODE_KEY) as FirecrawlMode | null) || 'cloud';
  const customUrl = window.localStorage.getItem(FIRECRAWL_CUSTOM_URL_KEY) || getDefaultFirecrawlCustomUrl();

  return {
    mode: mode === 'custom' ? 'custom' : 'cloud',
    customUrl,
  };
}

export function setFirecrawlConfig(config: FirecrawlConfig): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(FIRECRAWL_MODE_KEY, config.mode);
  window.localStorage.setItem(FIRECRAWL_CUSTOM_URL_KEY, config.customUrl.trim());
}

export function getActiveFirecrawlUrl(): string {
  const config = getFirecrawlConfig();
  return config.mode === 'custom' && config.customUrl.trim() ? config.customUrl.trim() : FIRECRAWL_CLOUD_URL;
}

export function getFirecrawlCloudUrl(): string {
  return FIRECRAWL_CLOUD_URL;
}
