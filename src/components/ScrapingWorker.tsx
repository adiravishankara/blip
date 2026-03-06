import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useScraping } from '../context/ScrapingContext';
import { processScrapingJob } from '../services/scraper';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, X } from 'lucide-react';

export function ScrapingWorker() {
  const { user } = useAuth();
  const { jobs, processingCount, isExpanded, setIsExpanded } = useScraping();
  const locallyStarted = useRef<Set<string>>(new Set());

  // Clean up local tracking when jobs change status
  useEffect(() => {
    const pendingIds = new Set(jobs.filter(j => j.status === 'pending').map(j => j.id));
    for (const id of locallyStarted.current) {
      if (!pendingIds.has(id)) {
        locallyStarted.current.delete(id);
      }
    }
  }, [jobs]);

  // Background worker logic
  useEffect(() => {
    let active = true;

    const processQueue = () => {
      if (!active) return;
      
      const pendingJobs = jobs.filter(j => j.status === 'pending' && !locallyStarted.current.has(j.id));
      const slotsAvailable = 5 - processingCount;
      
      if (slotsAvailable > 0 && pendingJobs.length > 0) {
        const jobsToStart = pendingJobs.slice(0, slotsAvailable);
        
        jobsToStart.forEach(nextJob => {
          locallyStarted.current.add(nextJob.id);
          console.log('[Worker] Concurrently starting pending job:', nextJob.id, 'URL:', nextJob.url);
          
          // Fire and forget; state is synchronized via Supabase Realtime later
          processScrapingJob(nextJob.id).catch(err => {
            console.error('[Worker] Fatal error starting job:', nextJob.id, err);
          });
        });
      }
    };

    processQueue();

    return () => {
      active = false;
    };
  }, [jobs, processingCount]);

  if (!user || jobs.length === 0) return null;

  return (
    <div className={`fixed bottom-4 left-4 z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
      {/* Header */}
      <div 
        className="bg-gray-900 text-white p-3 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(false)}
      >
        <div className="flex items-center gap-2">
          {processingCount > 0 ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
          <span className="text-sm font-medium">
            {processingCount > 0 ? 'Scraping Jobs...' : 'Scraping Queue'}
          </span>
          <span className="bg-gray-800 text-[10px] px-2 py-0.5 rounded-full text-gray-400">
            {jobs.length}
          </span>
        </div>
        <div className="p-1 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-4 h-4" />
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto p-2 space-y-2 bg-white">
        {jobs.map((job) => (
          <div key={job.id} className="p-3 bg-gray-50 rounded-lg flex flex-col gap-1 border border-gray-100">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {job.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-300" />}
                {job.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                {job.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-500" />}
                <span className="text-xs font-medium truncate text-gray-700">
                  {job.url}
                </span>
              </div>
              <a 
                href={job.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            
            {job.error && (
              <p className="text-[10px] text-red-500 mt-1 line-clamp-2 leading-tight">
                {job.error}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider ${
                job.status === 'pending' ? 'bg-gray-200 text-gray-600' :
                job.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                job.status === 'completed' ? 'bg-green-100 text-green-600' :
                'bg-red-100 text-red-600'
              }`}>
                {job.status}
              </span>
              <span className="text-[10px] text-gray-400">
                {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
