import { useMemo, useState } from 'react';
import { Job, JobPriority, JobStatus } from '../types';
import { getAgeState, isSuggestedFollowUpDue } from '../utils/jobHealth';

export interface FilterState {
  search: string;
  companies: string[];
  types: string[];
  priorities: JobPriority[];
  status: JobStatus[];
  hasResume: boolean | null;
  minMatchScore: number;
  groupByCompany: boolean;
  attentionOnly: boolean;
  overdueOnly: boolean;
  followUpDueOnly: boolean;
}

const defaultFilters: FilterState = {
  search: '',
  companies: [],
  types: [],
  priorities: [],
  status: [],
  hasResume: null,
  minMatchScore: 0,
  groupByCompany: true,
  attentionOnly: false,
  overdueOnly: false,
  followUpDueOnly: false,
};

export function useJobFilters(jobs: Job[]) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const availableCompanies = useMemo(() => {
    const companies = new Set(jobs.map(job => job.company).filter(Boolean));
    return Array.from(companies).sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          job.job_title.toLowerCase().includes(searchLower) ||
          job.company.toLowerCase().includes(searchLower) ||
          job.location?.toLowerCase().includes(searchLower) ||
          job.keywords?.some(k => k.toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;
      }

      if (filters.companies.length > 0 && !filters.companies.includes(job.company)) {
        return false;
      }

      if (filters.priorities.length > 0 && !filters.priorities.includes(job.priority)) {
        return false;
      }

      if (filters.status.length > 0 && !filters.status.includes(job.status)) {
        return false;
      }

      if (filters.hasResume !== null) {
        const hasResume = !!job.resume_link;
        if (hasResume !== filters.hasResume) return false;
      }

      if (filters.minMatchScore > 0 && (job.match_score || 0) < filters.minMatchScore) {
        return false;
      }

      const ageState = getAgeState(job);
      const hasFollowUpDue = isSuggestedFollowUpDue(job);
      const needsAttention = ageState !== 'healthy' || hasFollowUpDue;

      if (filters.attentionOnly && !needsAttention) {
        return false;
      }

      if (filters.overdueOnly && ageState !== 'overdue') {
        return false;
      }

      if (filters.followUpDueOnly && !hasFollowUpDue) {
        return false;
      }

      return true;
    });
  }, [jobs, filters]);

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  return {
    filters,
    setFilter,
    clearFilters,
    filteredJobs,
    availableCompanies,
  };
}

