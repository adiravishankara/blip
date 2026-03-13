import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Server, ScanSearch, Settings2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getActiveFirecrawlUrl, getFirecrawlCloudUrl, getFirecrawlConfig, setFirecrawlConfig, type FirecrawlMode } from '../../utils/storage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const FIRECRAWL_API_KEY = import.meta.env.VITE_FIRECRAWL_API_KEY;

type ServiceState = 'checking' | 'connected' | 'error';

interface ServiceStatus {
  state: ServiceState;
  kind: string;
  detail: string;
  url: string;
}

function inferSupabaseKind(url: string): string {
  return /localhost|127\.0\.0\.1/i.test(url) ? 'Local Supabase' : 'Cloud Supabase';
}

function inferFirecrawlKind(url: string): string {
  if (/ngrok|trycloudflare|tunnel|loca\.lt/i.test(url)) return 'Tunnel Firecrawl';
  if (/localhost|127\.0\.0\.1/i.test(url)) return 'Local Firecrawl';
  return 'Cloud Firecrawl';
}

function StatusDot({ state }: { state: ServiceState }) {
  if (state === 'checking') {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />;
  }

  if (state === 'connected') {
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  }

  return <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;
}

function ServicePill({ label, status, icon, children }: { label: string; status: ServiceStatus; icon: React.ReactNode; children?: React.ReactNode }) {
  const stateClasses =
    status.state === 'connected'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status.state === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <div className="group relative">
      <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateClasses}`}>
        {icon}
        <span>{label}</span>
        <StatusDot state={status.state} />
      </div>

      <div className="absolute right-0 top-full z-50 mt-2 hidden w-80 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-2xl group-hover:block">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="text-sm font-semibold text-gray-900">{status.kind}</p>
          <p className="text-xs text-gray-500">{status.detail}</p>
          <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] text-gray-700 break-all border border-gray-100">
            {status.url || 'Not configured'}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ConnectionStatus() {
  const [supabaseStatus, setSupabaseStatus] = useState<ServiceStatus>({
    state: 'checking',
    kind: inferSupabaseKind(SUPABASE_URL),
    detail: 'Checking connection',
    url: SUPABASE_URL,
  });
  const [firecrawlMode, setFirecrawlMode] = useState<FirecrawlMode>(getFirecrawlConfig().mode);
  const [customUrl, setCustomUrl] = useState<string>(getFirecrawlConfig().customUrl);
  const [activeFirecrawlUrl, setActiveFirecrawlUrl] = useState<string>(getActiveFirecrawlUrl());
  const [firecrawlStatus, setFirecrawlStatus] = useState<ServiceStatus>({
    state: 'checking',
    kind: inferFirecrawlKind(getActiveFirecrawlUrl()),
    detail: 'Checking connection',
    url: getActiveFirecrawlUrl(),
  });

  const firecrawlHeaders = useMemo(() => {
    const headers: HeadersInit = {};
    if (FIRECRAWL_API_KEY) {
      headers.Authorization = `Bearer ${FIRECRAWL_API_KEY}`;
    }
    return headers;
  }, []);

  useEffect(() => {
    let active = true;

    const checkSupabase = async () => {
      try {
        const { error } = await supabase.from('jobs').select('id').limit(1);
        if (!active) return;

        if (error && !String(error.message).toLowerCase().includes('permission')) {
          setSupabaseStatus({
            state: 'error',
            kind: inferSupabaseKind(SUPABASE_URL),
            detail: error.message,
            url: SUPABASE_URL,
          });
          return;
        }

        setSupabaseStatus({
          state: 'connected',
          kind: inferSupabaseKind(SUPABASE_URL),
          detail: 'Supabase responded successfully.',
          url: SUPABASE_URL,
        });
      } catch (error) {
        if (!active) return;
        setSupabaseStatus({
          state: 'error',
          kind: inferSupabaseKind(SUPABASE_URL),
          detail: error instanceof Error ? error.message : 'Connection failed',
          url: SUPABASE_URL,
        });
      }
    };

    const checkFirecrawl = async () => {
      try {
        const response = await fetch(activeFirecrawlUrl, {
          method: 'GET',
          headers: firecrawlHeaders,
        });

        if (!active) return;

        setFirecrawlStatus({
          state: response.ok || response.status > 0 ? 'connected' : 'error',
          kind: inferFirecrawlKind(activeFirecrawlUrl),
          detail: response.ok ? 'Firecrawl endpoint is reachable.' : `Endpoint responded with ${response.status}.`,
          url: activeFirecrawlUrl,
        });
      } catch (error) {
        if (!active) return;
        setFirecrawlStatus({
          state: 'error',
          kind: inferFirecrawlKind(activeFirecrawlUrl),
          detail: error instanceof Error ? error.message : 'Connection failed',
          url: activeFirecrawlUrl,
        });
      }
    };

    void checkSupabase();
    void checkFirecrawl();

    const interval = window.setInterval(() => {
      void checkSupabase();
      void checkFirecrawl();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeFirecrawlUrl, firecrawlHeaders]);

  const applyFirecrawlConfig = (mode: FirecrawlMode) => {
    const nextConfig = {
      mode,
      customUrl,
    };
    setFirecrawlMode(mode);
    setFirecrawlConfig(nextConfig);
    setActiveFirecrawlUrl(mode === 'custom' && customUrl.trim() ? customUrl.trim() : getFirecrawlCloudUrl());
    setFirecrawlStatus(prev => ({ ...prev, state: 'checking', detail: 'Checking connection' }));
  };

  const saveCustomUrl = () => {
    const nextCustomUrl = customUrl.trim();
    setCustomUrl(nextCustomUrl);
    setFirecrawlConfig({
      mode: firecrawlMode,
      customUrl: nextCustomUrl,
    });
    if (firecrawlMode === 'custom') {
      setActiveFirecrawlUrl(nextCustomUrl || getFirecrawlCloudUrl());
      setFirecrawlStatus(prev => ({ ...prev, state: 'checking', detail: 'Checking connection' }));
    }
  };

  return (
    <div className="hidden lg:flex items-center gap-2 mr-2">
      <ServicePill
        label="Supabase"
        status={supabaseStatus}
        icon={<Server className="w-3.5 h-3.5" />}
      />
      <ServicePill
        label="Firecrawl"
        status={firecrawlStatus}
        icon={<ScanSearch className="w-3.5 h-3.5" />}
      >
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700">
            <Settings2 className="w-3.5 h-3.5" />
            Endpoint Selection
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-gray-200 p-2 text-xs text-gray-700">
            <input
              type="radio"
              name="firecrawl-mode"
              checked={firecrawlMode === 'cloud'}
              onChange={() => applyFirecrawlConfig('cloud')}
              className="mt-0.5"
            />
            <span>
              <span className="block font-semibold text-gray-900">Cloud Firecrawl</span>
              <span className="block text-gray-500 break-all">{getFirecrawlCloudUrl()}</span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-lg border border-gray-200 p-2 text-xs text-gray-700">
            <input
              type="radio"
              name="firecrawl-mode"
              checked={firecrawlMode === 'custom'}
              onChange={() => applyFirecrawlConfig('custom')}
              className="mt-0.5"
            />
            <span className="block w-full">
              <span className="block font-semibold text-gray-900">Custom Firecrawl</span>
              <input
                type="url"
                value={customUrl}
                onChange={(event) => setCustomUrl(event.target.value)}
                onBlur={saveCustomUrl}
                placeholder="https://your-ngrok-url/v2/scrape"
                className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={saveCustomUrl}
                className="mt-2 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold text-white"
              >
                Save custom URL
              </button>
            </span>
          </label>
        </div>
      </ServicePill>
    </div>
  );
}
