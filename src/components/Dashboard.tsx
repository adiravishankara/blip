import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { KanbanBoard } from './KanbanBoard';
import { HomeView } from './HomeView';
import { AddJobModal } from './AddJobModal';
import { JobDetailModal } from './JobDetailModal';
import { UserProfileModal } from './UserProfileModal';
import { OnboardingModal } from './OnboardingModal';
import { Header } from './layout/Header';
import { BoardHeader } from './layout/BoardHeader';
import { FilterBar } from './layout/FilterBar';
import { FloatingActionButton } from './FloatingActionButton';
import { useJobFilters } from '../hooks/useJobFilters';
import { Job } from '../types';
import { enqueueScrapingJob } from '../services/scraper';
import { useScraping } from '../context/ScrapingContext';
import { utils, writeFile } from 'xlsx';

export function Dashboard() {
  const { user, profile, profileLoaded } = useAuth();
  const { refreshQueue } = useScraping();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Kanban board'>('Dashboard');

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  const { filters, setFilter, clearFilters, filteredJobs, availableCompanies } = useJobFilters(jobs);

  useEffect(() => {
    if (user) {
      loadJobs();

      // Robust Polling Fallback
      // Fetch jobs every 5 seconds nicely handling missing Realtime events
      const interval = setInterval(() => {
        loadJobs();
      }, 5000);

      // Listen for real-time changes to the jobs table
      console.log('[Dashboard] Subscribing to jobs changes for user:', user.id);
      const channel = supabase
        .channel('jobs_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('[Dashboard] Realtime update received:', payload.eventType);
            loadJobs();
          }
        )
        .subscribe((status) => {
          console.log('[Dashboard] Subscription status:', status);
        });

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }, [user]); // Removed refreshKey from dependencies to avoid full unmount/remount cycles

  const loadJobs = async (silent = true) => {
    try {
      if (!silent) setInitialLoad(true);
      
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('date_added', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setInitialLoad(false);
    }
  };

  const handleRefresh = () => {
    // Force a fresh, completely silent update when user manually updates something (like dragging a card)
    loadJobs(true);
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setScrapedData(null);
    handleRefresh();
  };

  const handleLinkSubmit = async (link: string) => {
    try {
      if (!user) return;
      await enqueueScrapingJob(link, user.id);
      refreshQueue(); // Immediately inform context
      setFabOpen(false);
    } catch (error) {
      console.error('Error extracting job:', error);
      alert('Failed to add job to queue.');
    }
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const handleExportSelected = () => {
    const jobsToExport = jobs.filter(j => selectedJobs.has(j.id));
    if (jobsToExport.length === 0) {
      alert("No jobs selected.");
      return;
    }

    const data = jobsToExport.map(job => [
      job.job_url || '',
      job.job_title || '',
      job.company || '',
      job.location || '',
      job.team || '',
      '', // Description
      job.match_score || '', // Relevance
      job.status || '', // Status
      job.notes || '', // Notes
      job.date_added ? new Date(job.date_added).toLocaleDateString() : '', // Date Added
      job.resume_link || '', // Resume
      job.referred_by || '', // Referral
      '', // Recruiter
      job.contact_person || '', // Hiring Manager
    ]);

    const worksheet = utils.aoa_to_sheet([
      [
        'Link', 'Job Title', 'Company', 'Location', 'Field', 'Description', 
        'Relevance to my profile (from my perspective)', 'Status', 'Notes', 
        'Date Added', 'Resume', 'Referral', 'Recruiter', 'Hiring Manager'
      ],
      ...data
    ]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Jobs');
    writeFile(workbook, 'Tracker.xlsx');

    setSelectionMode(false);
    setSelectedJobs(new Set());
  };

  if (!profileLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Determine if onboarding is needed (no profile or missing basic info)
  const needsOnboarding = !profile || !profile.full_name || !profile.role_type;

  const userInitials = profile?.full_name 
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-white">
      {needsOnboarding && <OnboardingModal onComplete={handleRefresh} />}
      

      <Header 
        searchValue={filters.search} 
        onSearchChange={(val) => setFilter('search', val)}
        onCreateClick={() => setFabOpen(true)}
        onProfileClick={() => setShowProfile(true)}
        userInitials={userInitials}
        currentTab={activeTab}
        onTabChange={setActiveTab}
      />
      <BoardHeader 
        userInitials={userInitials} 
        currentTab={activeTab} 
        onExportClick={() => {
          setSelectionMode(true);
          setSelectedJobs(new Set());
        }}
      />
      
      {activeTab === 'Kanban board' && (
        <FilterBar 
          filters={filters} 
          setFilter={setFilter} 
          availableCompanies={availableCompanies} 
          onClear={clearFilters}
          userInitials={userInitials}
        />
      )}

      <main className="py-6 overflow-hidden">
        {activeTab === 'Dashboard' ? (
          <HomeView 
            jobs={jobs} 
            onViewBoard={() => setActiveTab('Kanban board')} 
            onSelectJob={setSelectedJob}
          />
        ) : (
          <KanbanBoard
            jobs={filteredJobs}
            loading={initialLoad}
            onSelectJob={setSelectedJob}
            onUpdate={handleRefresh}
            selectionMode={selectionMode}
            selectedJobs={selectedJobs}
            toggleJobSelection={toggleJobSelection}
            groupByCompany={filters.groupByCompany}
          />
        )}
      </main>

      <FloatingActionButton 
        isOpen={fabOpen}
        onToggle={setFabOpen}
        onManualClick={() => {
          setScrapedData(null);
          setShowAddModal(true);
        }} 
        onLinkSubmit={handleLinkSubmit} 
      />

      {selectionMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom border border-gray-700">
          <span className="font-medium">{selectedJobs.size} jobs selected</span>
          <div className="h-5 w-px bg-gray-700"></div>
          <button 
            onClick={() => {
              setSelectionMode(false);
              setSelectedJobs(new Set());
            }} 
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleExportSelected}
            disabled={selectedJobs.size === 0}
            className="bg-white disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      )}

      {showAddModal && (
        <AddJobModal
          initialData={scrapedData}
          onClose={() => {
            setShowAddModal(false);
            setScrapedData(null);
          }}
          onSuccess={handleAddSuccess}
        />
      )}

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdate={handleRefresh}
        />
      )}

      {showProfile && (
        <UserProfileModal onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}

