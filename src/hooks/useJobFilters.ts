import { useState, useMemo } from 'react';
import { Job, JobStatus, JobPriority } from '../types';

export interface FilterState {
    search: string;
    companies: string[];
    types: string[]; // Job title keywords or specific types if added
    priorities: JobPriority[];
    status: JobStatus[];
    hasResume: boolean | null;
    minMatchScore: number;
    groupByCompany: boolean;
}

export function useJobFilters(jobs: Job[]) {
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        companies: [],
        types: [],
        priorities: [],
        status: [],
        hasResume: null,
        minMatchScore: 0,
        groupByCompany: true,
    });

    const availableCompanies = useMemo(() => {
        const companies = new Set(jobs.map(job => job.company).filter(Boolean));
        return Array.from(companies).sort();
    }, [jobs]);

    const filteredJobs = useMemo(() => {
        return jobs.filter(job => {
            // Search text
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const matchesSearch =
                    job.job_title.toLowerCase().includes(searchLower) ||
                    job.company.toLowerCase().includes(searchLower) ||
                    job.location?.toLowerCase().includes(searchLower) ||
                    job.keywords?.some(k => k.toLowerCase().includes(searchLower));

                if (!matchesSearch) return false;
            }

            // Company filter
            if (filters.companies.length > 0 && !filters.companies.includes(job.company)) {
                return false;
            }

            // Priority filter
            if (filters.priorities.length > 0 && !filters.priorities.includes(job.priority)) {
                return false;
            }

            // Status filter (though board is already grouped by status, this helps with global counts)
            if (filters.status.length > 0 && !filters.status.includes(job.status)) {
                return false;
            }

            // Has Resume filter
            if (filters.hasResume !== null) {
                const hasResume = !!job.resume_link;
                if (hasResume !== filters.hasResume) return false;
            }

            // Match Score filter
            if (filters.minMatchScore > 0 && (job.match_score || 0) < filters.minMatchScore) {
                return false;
            }

            return true;
        });
    }, [jobs, filters]);

    const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            companies: [],
            types: [],
            priorities: [],
            status: [],
            hasResume: null,
            minMatchScore: 0,
            groupByCompany: true,
        });
    };

    return {
        filters,
        setFilter,
        clearFilters,
        filteredJobs,
        availableCompanies,
    };
}
