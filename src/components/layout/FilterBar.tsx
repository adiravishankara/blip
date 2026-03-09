import { Search, ChevronDown } from 'lucide-react';
import { FilterState } from '../../hooks/useJobFilters';
import { JobPriority } from '../../types';

interface FilterBarProps {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  availableCompanies: string[];
  onClear: () => void;
  userInitials?: string;
}

export function FilterBar({ filters, setFilter, availableCompanies, onClear, userInitials = 'JD' }: FilterBarProps) {

  return (
    <div className="bg-white px-8 py-4 flex flex-wrap items-center gap-4 border-b border-gray-100">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          placeholder="Search board"
          className="pl-9 pr-4 py-1.5 border-2 border-transparent hover:border-gray-200 focus:border-blue-500 rounded bg-gray-50 focus:bg-white outline-none transition-all text-sm w-40 md:w-56"
        />
      </div>

      <div className="flex -space-x-1">
        <div 
          className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold uppercase bg-indigo-500"
        >
          {userInitials}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors">
            Company
            <ChevronDown className="w-4 h-4" />
          </button>
          
          <div className="absolute left-0 top-full pt-2 w-52 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="bg-white border border-gray-200 rounded-xl shadow-2xl py-2 overflow-hidden max-h-[300px] overflow-y-auto">
              <div className="px-4 py-1.5 border-b border-gray-50 mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filter by Company</span>
              </div>
              {availableCompanies.map(company => (
                <label key={company} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.companies.includes(company)}
                    onChange={(e) => {
                      const newCompanies = e.target.checked
                        ? [...filters.companies, company]
                        : filters.companies.filter(c => c !== company);
                      setFilter('companies', newCompanies);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 mr-3 w-4 h-4 border-gray-300"
                  />
                  <span className="text-sm text-gray-700 font-medium">{company}</span>
                </label>
              ))}
              {availableCompanies.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 italic">No companies found</div>
              )}
            </div>
          </div>
        </div>

        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors">
            Priority
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="absolute left-0 top-full pt-2 w-48 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="bg-white border border-gray-200 rounded-xl shadow-2xl py-2 overflow-hidden">
              <div className="px-4 py-1.5 border-b border-gray-50 mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Priority Level</span>
              </div>
              {(['low', 'medium', 'high', 'critical'] as JobPriority[]).map(p => (
                <label key={p} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.priorities.includes(p)}
                    onChange={(e) => {
                      const newP = e.target.checked
                        ? [...filters.priorities, p]
                        : filters.priorities.filter(item => item !== p);
                      setFilter('priorities', newP);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 mr-3 w-4 h-4 border-gray-300"
                  />
                  <span className="text-sm text-gray-700 capitalize font-medium">{p}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={() => setFilter('hasResume', filters.hasResume === true ? null : true)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors
            ${filters.hasResume === true ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'}`}
        >
          Has Resume
        </button>

        <button 
          onClick={() => setFilter('groupByCompany', !filters.groupByCompany)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors
            ${filters.groupByCompany ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'}`}
        >
          Group by Company
        </button>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <div className="relative group">
          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors"
          >
            Quick filters
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="absolute left-0 top-full pt-2 w-56 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="bg-white border border-gray-200 rounded-xl shadow-2xl py-2 overflow-hidden">
              <div className="px-4 py-1.5 border-b border-gray-50 mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Shortcuts</span>
              </div>
              <button 
                onClick={() => {
                  setFilter('priorities', ['high', 'critical']);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <div className="w-6 text-center">🔥</div>
                <span className="font-medium">High Priority roles</span>
              </button>
              <button 
                onClick={() => {
                  setFilter('status', ['interviewing']);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <div className="w-6 text-center">📅</div>
                <span className="font-medium">In Interview Process</span>
              </button>
              <button 
                onClick={() => {
                  setFilter('hasResume', true);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <div className="w-6 text-center">📄</div>
                <span className="font-medium">Applied w/ Resume</span>
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={onClear}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 ml-2"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
