import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { KanbanBoard } from './KanbanBoard';
import { AddJobModal } from './AddJobModal';
import { JobDetailModal } from './JobDetailModal';
import { UserProfileModal } from './UserProfileModal';
import { Header } from './layout/Header';
import { BoardHeader } from './layout/BoardHeader';
import { FilterBar } from './layout/FilterBar';
import { FloatingActionButton } from './FloatingActionButton';
import { useJobFilters } from '../hooks/useJobFilters';
import { Job } from '../types';

export function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
    handleRefresh();
  };

  const handleLinkSubmit = (link: string) => {
    console.log('Link submitted:', link);
    // TODO: Implement pipeline for link extraction
    alert(`Link extraction for ${link} is coming soon! For now, please add manually.`);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header 
        searchValue={filters.search} 
        onSearchChange={(val) => setFilter('search', val)}
        onCreateClick={() => setShowAddModal(true)}
      />
      <BoardHeader />
      <FilterBar 
        filters={filters} 
        setFilter={setFilter} 
        availableCompanies={availableCompanies} 
        onClear={clearFilters}
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
        onManualClick={() => setShowAddModal(true)} 
        onLinkSubmit={handleLinkSubmit} 
      />

      {showAddModal && (
        <AddJobModal
          onClose={() => setShowAddModal(false)}
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

