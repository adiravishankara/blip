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
      />
      <BoardHeader 
        userInitials={userInitials} 
        currentTab={activeTab} 
        onTabChange={setActiveTab} 
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

