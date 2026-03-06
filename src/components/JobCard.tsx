import { Job } from '../types';
import { MapPin, Calendar, DollarSign, Flag, Wifi, Building2, GitBranch, ExternalLink } from 'lucide-react';
import { MatchScoreBadge } from './MatchScoreBadge';

interface JobCardProps {
  job: Job;
  onClick: () => void;
}

const PRIORITY_CONFIG = {
  low: { color: 'bg-blue-50 text-blue-700', icon: 'text-blue-400' },
  medium: { color: 'bg-yellow-50 text-yellow-700', icon: 'text-yellow-500' },
  high: { color: 'bg-orange-50 text-orange-700', icon: 'text-orange-500' },
  critical: { color: 'bg-red-50 text-red-700', icon: 'text-red-500' },
};

const WORK_MODE_ICON = {
  remote: <Wifi className="w-3.5 h-3.5" />,
  hybrid: <GitBranch className="w-3.5 h-3.5" />,
  onsite: <Building2 className="w-3.5 h-3.5" />,
};

export function JobCard({ job, onClick }: JobCardProps) {
  const daysSinceAdded = Math.floor(
    (new Date().getTime() - new Date(job.date_added).getTime()) / (1000 * 60 * 60 * 24)
  );

  const priorityConfig = PRIORITY_CONFIG[job.priority];

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition cursor-pointer group"
    >
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition text-sm leading-snug">
            {job.job_title}
          </h3>
          <Flag className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${priorityConfig.icon}`} />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500 font-medium truncate">{job.company}</p>
          {job.job_url && (
            <a 
              href={job.job_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={(e) => e.stopPropagation()}
              className="text-blue-500 hover:text-blue-700 transition"
              title="View Job Posting"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-1 mb-3">
        {job.location && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        )}
        {job.pay_scale && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{job.pay_scale}</span>
          </div>
        )}
        {job.work_mode && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 capitalize">
            {WORK_MODE_ICON[job.work_mode]}
            <span>{job.work_mode}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-gray-100">
        <div className="flex items-center gap-1 text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{daysSinceAdded}d</span>
        </div>
        <div className="flex items-center gap-2">
          {job.match_score != null && <MatchScoreBadge score={job.match_score} size="sm" />}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${priorityConfig.color}`}>
            {job.priority}
          </span>
        </div>
      </div>
    </div>
  );
}
