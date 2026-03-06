import { useState } from 'react';
import { Job, JobStatus } from '../types';
import { supabase } from '../lib/supabase';
import { JobCard } from './JobCard';

const COLUMNS: { status: JobStatus; label: string; color: string }[] = [
  { status: 'saved', label: 'BACKLOG', color: 'bg-gray-100' },
  { status: 'applying', label: 'PREPARING', color: 'bg-gray-100' },
  { status: 'applied', label: 'APPLIED', color: 'bg-gray-100' },
  { status: 'interviewing', label: 'INTERVIEWING', color: 'bg-gray-100' },
  { status: 'accepted', label: 'OFFERED', color: 'bg-gray-100' },
  { status: 'rejected', label: 'REJECTED', color: 'bg-gray-100' },
  { status: 'ghosted', label: 'GHOSTED', color: 'bg-gray-100' },
];

interface KanbanBoardProps {
  jobs: Job[];
  loading: boolean;
  onSelectJob: (job: Job) => void;
  onUpdate: () => void;
}

export function KanbanBoard({ jobs, loading, onSelectJob, onUpdate }: KanbanBoardProps) {
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<JobStatus | null>(null);

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
      onUpdate();
    } catch (error) {
      console.error('Error updating job status:', error);
    } finally {
      setDraggedJobId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 font-medium font-sm">Loading board...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-8 h-full min-h-[calc(100vh-280px)] px-8">
      {COLUMNS.map(column => {
        const columnJobs = getJobsByStatus(column.status);
        const isBeingDraggedOver = dragOverStatus === column.status;
        return (
          <div key={column.status} className="flex-shrink-0 w-[280px] flex flex-col">
            <div className="px-2 py-3 flex items-center gap-2">
              <h3 className="text-[11px] font-bold text-gray-500 tracking-wider">
                {column.label}
              </h3>
              <span className="bg-gray-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-600">
                {columnJobs.length}
              </span>
            </div>

            <div
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
              className={`flex-1 space-y-3 min-h-[300px] rounded-lg p-2 transition-colors duration-200 border-2 border-transparent ${
                isBeingDraggedOver ? 'bg-blue-50 border-blue-300' : 'bg-gray-50/50 hover:bg-gray-100/50'
              }`}
            >
              {columnJobs.map(job => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, job.id)}
                  className={`cursor-grab active:cursor-grabbing transition-transform ${
                    draggedJobId === job.id ? 'opacity-40 scale-95' : 'hover:-translate-y-1'
                  }`}
                >
                  <JobCard
                    job={job}
                    onClick={() => onSelectJob(job)}
                  />
                </div>
              ))}

              {columnJobs.length === 0 && !isBeingDraggedOver && (
                <div className="text-center text-gray-400 text-[11px] py-12 font-medium">
                  {/* Empty space */}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

