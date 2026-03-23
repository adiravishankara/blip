import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { failTimedOutScrapingJobs, ScrapingJob } from '../services/scraper';

interface ScrapingContextType {
  jobs: ScrapingJob[];
  pendingCount: number;
  processingCount: number;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  clearJobs: () => void;
  refreshQueue: () => void;
}

const ScrapingContext = createContext<ScrapingContextType | undefined>(undefined);

export function ScrapingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadActiveJobs = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('scraping_jobs')
      .select('*')
      .eq('user_id', user.id)
      .or('status.eq.pending,status.eq.processing')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setJobs(data);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setJobs([]);
      return;
    }

    loadActiveJobs();

    console.log('[ScrapingContext] Subscribing to realtime changes for user:', user.id);
    const channel = supabase
      .channel('scraping_jobs_context')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scraping_jobs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[ScrapingContext] Realtime update received:', payload.eventType);
          loadActiveJobs();
        }
      )
      .subscribe((status) => {
        console.log('[ScrapingContext] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadActiveJobs]);

  // Robust Polling Fallback 
  useEffect(() => {
    if (!user) return;
    
    // Ping the backend every 3 seconds to ensure UI doesn't get stuck
    // just in case Realtime events are dropped or delayed
    const interval = setInterval(() => {
      failTimedOutScrapingJobs(user.id).catch(error => {
        console.error('[ScrapingContext] Failed to expire timed out jobs:', error);
      });
      loadActiveJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, [user, loadActiveJobs]);

  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const processingCount = jobs.filter(j => j.status === 'processing').length;

  const clearJobs = () => setJobs([]);
  const refreshQueue = () => loadActiveJobs();

  return (
    <ScrapingContext.Provider value={{ 
      jobs, 
      pendingCount, 
      processingCount, 
      isExpanded, 
      setIsExpanded,
      clearJobs,
      refreshQueue
    }}>
      {children}
    </ScrapingContext.Provider>
  );
}

export function useScraping() {
  const context = useContext(ScrapingContext);
  if (context === undefined) {
    throw new Error('useScraping must be used within a ScrapingProvider');
  }
  return context;
}
