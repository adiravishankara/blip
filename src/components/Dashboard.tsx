import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KanbanBoard } from './KanbanBoard';
import { AddJobModal } from './AddJobModal';
import { JobDetailModal } from './JobDetailModal';
import { UserProfileModal } from './UserProfileModal';
import { Job } from '../types';
import { Briefcase, Plus, LogOut, UserCircle } from 'lucide-react';

export function Dashboard() {
  const { signOut, user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleAddSuccess = () => {
    setShowAddModal(false);
    handleRefresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">blip</h1>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                Add Job
              </button>
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                title="My Profile"
              >
                <UserCircle className="w-5 h-5" />
                Profile
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-6">
        <KanbanBoard
          key={refreshKey}
          onAddJob={() => setShowAddModal(true)}
          onSelectJob={setSelectedJob}
        />
      </main>

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
