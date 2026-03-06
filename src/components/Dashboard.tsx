import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { KanbanBoard } from './KanbanBoard';
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
import { extractJobFromUrl } from '../services/scraper';

export function Dashboard() {
  const { user, profile, profileLoaded } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scrapedData, setScrapedData] = useState<any>(null);

  const { filters, setFilter, clearFilters, filteredJobs, availableCompanies } = useJobFilters(jobs);

  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user, refreshKey]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('date_added', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setScrapedData(null);
    handleRefresh();
  };

  const handleLinkSubmit = async (link: string) => {
    try {
      setScraping(true);
      const data = await extractJobFromUrl(link);
      
      setScrapedData({
        job_title: data.job_title,
        company: data.company_name,
        job_url: link,
        location: data.location,
        pay_scale: data.compensation,
        team: data.team_name,
        job_description: data.description,
      });
      setShowAddModal(true);
    } catch (error) {
      console.error('Error extracting job:', error);
      alert('Failed to extract job details. Opening manual entry.');
      setScrapedData({ job_url: link });
      setShowAddModal(true);
    } finally {
      setScraping(false);
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
      
      {scraping && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-gray-700">Analyzing job post with Firecrawl...</p>
          </div>
        </div>
      )}

      <Header 
        searchValue={filters.search} 
        onSearchChange={(val) => setFilter('search', val)}
        onCreateClick={() => setFabOpen(true)}
        onProfileClick={() => setShowProfile(true)}
        userInitials={userInitials}
      />
      <BoardHeader userInitials={userInitials} />
      <FilterBar 
        filters={filters} 
        setFilter={setFilter} 
        availableCompanies={availableCompanies} 
        onClear={clearFilters}
        userInitials={userInitials}
      />

      <main className="py-6 overflow-hidden">
        <KanbanBoard
          jobs={filteredJobs}
          loading={loading}
          onSelectJob={setSelectedJob}
          onUpdate={handleRefresh}
        />
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

