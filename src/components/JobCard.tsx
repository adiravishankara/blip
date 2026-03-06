import { Job } from '../types';
import { Calendar, Flag, ExternalLink } from 'lucide-react';

interface JobCardProps {
  job: Job;
  onClick: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
}

const PRIORITY_ICON = {
  low: <Flag className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />,
  medium: <Flag className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />,
  high: <Flag className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />,
  critical: <Flag className="w-3.5 h-3.5 text-red-500 fill-red-500" />,
};

export function JobCard({ job, onClick, selectionMode, isSelected }: JobCardProps) {
  const daysSinceAdded = Math.floor(
    (new Date().getTime() - new Date(job.date_added).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded border p-3 shadow-sm transition-all group select-none relative cursor-pointer
        ${selectionMode && isSelected ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-blue-50/30'}
      `}
    >
      {selectionMode && (
        <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm bg-white z-10
          ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}
        `}>
          {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {/* Title and Company */}
        <div>
          <h3 className="text-[13px] font-medium text-gray-800 leading-tight group-hover:text-blue-600 transition-colors mb-1">
            {job.job_title}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-tight">
              {job.company}
            </span>
            {job.job_url && (
              <a 
                href={job.job_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-blue-500 transition-colors"
                title="View Job Posting"
              >
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>

        {/* Small Metadata - Days on board and Priority only */}
        <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-100/50">
          <div className="flex items-center gap-2">
            <div>{PRIORITY_ICON[job.priority]}</div>
          </div>
          
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
            <Calendar className="w-2.5 h-2.5" />
            <span>{daysSinceAdded}d</span>
          </div>
        </div>
      </div>
    </div>
  );
}

