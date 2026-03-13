import { useMemo, useState } from 'react';
import { Job, JobStatus } from '../types';
import { supabase } from '../lib/supabase';
import { JobCard } from './JobCard';
import { getAgeState, getSuggestedFollowUp } from '../utils/jobHealth';

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
  selectionMode?: boolean;
  selectedJobs?: Set<string>;
  toggleJobSelection?: (jobId: string) => void;
  groupByCompany?: boolean;
}

export function KanbanBoard({ jobs, loading, onSelectJob, onUpdate, selectionMode, selectedJobs, toggleJobSelection, groupByCompany }: KanbanBoardProps) {
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<JobStatus | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const jobsByStatus = useMemo(() => {
    return COLUMNS.reduce<Record<JobStatus, Job[]>>((acc, column) => {
      const columnJobs = jobs.filter(job => job.status === column.status);
      acc[column.status] = [...columnJobs].sort((a, b) => {
        const aAttention = Number(getAgeState(a) === 'overdue' || !!getSuggestedFollowUp(a));
        const bAttention = Number(getAgeState(b) === 'overdue' || !!getSuggestedFollowUp(b));
        if (aAttention !== bAttention) return bAttention - aAttention;
        return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
      });
      return acc;
    }, {} as Record<JobStatus, Job[]>);
  }, [jobs]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    if (selectionMode) {
      e.preventDefault();
      return;
    }
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
        const columnJobs = jobsByStatus[column.status] ?? [];
        const isBeingDraggedOver = dragOverStatus === column.status;
        const attentionCount = columnJobs.filter(job => getAgeState(job) === 'overdue' || !!getSuggestedFollowUp(job)).length;

        return (
          <div key={column.status} className="flex-shrink-0 w-[280px] flex flex-col">
            <div className="px-2 py-3 flex items-center gap-2">
              <h3 className="text-[11px] font-bold text-gray-500 tracking-wider">
                {column.label}
              </h3>
              <span className="bg-gray-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-600">
                {columnJobs.length}
              </span>
              {attentionCount > 0 && (
                <span className="bg-rose-50 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-700">
                  {attentionCount} attention
                </span>
              )}
            </div>

            <div
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
              className={`flex-1 space-y-3 min-h-[300px] rounded-lg p-2 transition-colors duration-200 border-2 border-transparent ${
                isBeingDraggedOver ? 'bg-blue-50 border-blue-300' : 'bg-gray-50/50 hover:bg-gray-100/50'
              }`}
            >
              {(() => {
                if (!groupByCompany) {
                  return columnJobs.map(job => (
                    <div
                      key={job.id}
                      draggable={!selectionMode}
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      className={`transition-transform ${
                        selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        draggedJobId === job.id ? 'opacity-40 scale-95' : 'hover:-translate-y-1'
                      }`}
                    >
                      <JobCard
                        job={job}
                        onClick={() => {
                          if (selectionMode && toggleJobSelection) {
                            toggleJobSelection(job.id);
                          } else {
                            onSelectJob(job);
                          }
                        }}
                        selectionMode={selectionMode}
                        isSelected={selectedJobs?.has(job.id)}
                        allJobs={jobs}
                      />
                    </div>
                  ));
                }

                const groups: Record<string, Job[]> = {};
                const singles: Job[] = [];
                const companyCounts: Record<string, number> = {};

                for (const job of columnJobs) {
                  const comp = job.company || 'Unknown';
                  companyCounts[comp] = (companyCounts[comp] || 0) + 1;
                }

                columnJobs.forEach(job => {
                  const comp = job.company || 'Unknown';
                  if (companyCounts[comp] > 1) {
                    if (!groups[comp]) groups[comp] = [];
                    groups[comp].push(job);
                  } else {
                    singles.push(job);
                  }
                });

                return (
                  <>
                    {Object.entries(groups).map(([comp, groupJobs]) => {
                      const groupId = `${column.status}-${comp}`;
                      const isCollapsed = collapsedGroups[groupId];
                      return (
                        <div key={groupId} className="border border-gray-200 rounded-lg bg-gray-50/50 mb-3 overflow-hidden shadow-sm">
                          <button
                            onClick={() => toggleGroup(groupId)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700 outline-none"
                          >
                            <div className="flex z-10 items-center justify-between gap-2 overflow-hidden w-full">
                              <span className="truncate text-xs font-bold text-gray-600">{comp}</span>
                              <div className="flex items-center gap-2">
                                <span className="flex-shrink-0 bg-gray-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-700">
                                  {groupJobs.length} roles
                                </span>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </button>
                          {!isCollapsed && (
                            <div className="p-2 space-y-3 bg-gray-50">
                              {groupJobs.map(job => (
                                <div
                                  key={job.id}
                                  draggable={!selectionMode}
                                  onDragStart={(e) => handleDragStart(e, job.id)}
                                  className={`transition-transform ${
                                    selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                                  } ${
                                    draggedJobId === job.id ? 'opacity-40 scale-95' : 'hover:-translate-y-1'
                                  }`}
                                >
                                  <JobCard
                                    job={job}
                                    onClick={() => {
                                      if (selectionMode && toggleJobSelection) {
                                        toggleJobSelection(job.id);
                                      } else {
                                        onSelectJob(job);
                                      }
                                    }}
                                    selectionMode={selectionMode}
                                    isSelected={selectedJobs?.has(job.id)}
                                    allJobs={jobs}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {singles.map(job => (
                      <div
                        key={job.id}
                        draggable={!selectionMode}
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        className={`transition-transform ${
                          selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                        } ${
                          draggedJobId === job.id ? 'opacity-40 scale-95' : 'hover:-translate-y-1'
                        }`}
                      >
                        <JobCard
                          job={job}
                          onClick={() => {
                            if (selectionMode && toggleJobSelection) {
                              toggleJobSelection(job.id);
                            } else {
                              onSelectJob(job);
                            }
                          }}
                          selectionMode={selectionMode}
                          isSelected={selectedJobs?.has(job.id)}
                          allJobs={jobs}
                        />
                      </div>
                    ))}
                  </>
                );
              })()}

              {columnJobs.length === 0 && !isBeingDraggedOver && (
                <div className="text-center text-gray-400 text-[11px] py-12 font-medium"></div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
