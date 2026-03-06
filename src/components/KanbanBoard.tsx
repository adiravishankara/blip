import { useState, useEffect } from 'react';
import { Job, JobStatus } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { JobCard } from './JobCard';
import { Plus } from 'lucide-react';

const COLUMNS: { status: JobStatus; label: string; color: string }[] = [
  { status: 'saved', label: 'Saved', color: 'bg-gray-100' },
  { status: 'applying', label: 'Applying', color: 'bg-yellow-100' },
  { status: 'applied', label: 'Applied', color: 'bg-blue-100' },
  { status: 'interviewing', label: 'Interviewing', color: 'bg-purple-100' },
  { status: 'accepted', label: 'Accepted', color: 'bg-green-100' },
  { status: 'rejected', label: 'Rejected', color: 'bg-red-100' },
  { status: 'ghosted', label: 'Ghosted', color: 'bg-orange-100' },
];

interface KanbanBoardProps {
  onAddJob: () => void;
  onSelectJob: (job: Job) => void;
}

export function KanbanBoard({ onAddJob, onSelectJob }: KanbanBoardProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<JobStatus | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user]);

  const loadJobs = async () => {
    try {
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

  const getJobsByStatus = (status: JobStatus) => {
    return jobs.filter(job => job.status === status);
  };

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: JobStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: JobStatus) => {
    e.preventDefault();
    setDragOverStatus(null);

    if (!draggedJobId) return;

    const draggedJob = jobs.find(j => j.id === draggedJobId);
    if (!draggedJob || draggedJob.status === targetStatus) {
      setDraggedJobId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: targetStatus })
        .eq('id', draggedJobId);

      if (error) throw error;

      setJobs(jobs.map(job =>
        job.id === draggedJobId ? { ...job, status: targetStatus } : job
      ));
    } catch (error) {
      console.error('Error updating job status:', error);
    } finally {
      setDraggedJobId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {COLUMNS.map(column => {
        const columnJobs = getJobsByStatus(column.status);
        const isBeingDraggedOver = dragOverStatus === column.status;
        return (
          <div key={column.status} className="flex-shrink-0 w-80">
            <div className={`${column.color} rounded-lg p-3 mb-3`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {column.label}
                </h3>
                <span className="bg-white px-2 py-0.5 rounded-full text-sm font-medium text-gray-700">
                  {columnJobs.length}
                </span>
              </div>
            </div>

            <div
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
              className={`space-y-3 min-h-[200px] rounded-lg p-2 transition ${
                isBeingDraggedOver ? 'bg-blue-50 border-2 border-blue-300' : 'bg-transparent'
              }`}
            >
              {columnJobs.map(job => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, job.id)}
                  className={`cursor-grab active:cursor-grabbing transition ${
                    draggedJobId === job.id ? 'opacity-50' : ''
                  }`}
                >
                  <JobCard
                    job={job}
                    onClick={() => onSelectJob(job)}
                  />
                </div>
              ))}

              {columnJobs.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">
                  No jobs
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
