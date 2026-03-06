import { Search, ChevronDown, ListFilter, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { FilterState } from '../../hooks/useJobFilters';
import { JobPriority } from '../../types';

interface FilterBarProps {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  availableCompanies: string[];
  onClear: () => void;
}

export function FilterBar({ filters, setFilter, availableCompanies, onClear }: FilterBarProps) {
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
        {[1, 2].map((i) => (
          <div 
            key={i} 
            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold uppercase
              ${i === 1 ? 'bg-indigo-500' : 'bg-emerald-500'}`}
          >
            {i === 1 ? 'JD' : 'AV'}
          </div>
        ))}
        <button className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-gray-500 text-xs hover:bg-gray-200 transition-colors">
          +
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          multiple
          className="sr-only"
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions).map(o => o.value);
            setFilter('companies', values);
          }}
        />
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors">
            Company
            <ChevronDown className="w-4 h-4" />
          </button>
          
          <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg py-1 hidden group-hover:block z-10">
            {availableCompanies.map(company => (
              <label key={company} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.companies.includes(company)}
                  onChange={(e) => {
                    const newCompanies = e.target.checked
                      ? [...filters.companies, company]
                      : filters.companies.filter(c => c !== company);
                    setFilter('companies', newCompanies);
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700">{company}</span>
              </label>
            ))}
            {availableCompanies.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-400">No companies found</div>
            )}
          </div>
        </div>

        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors">
            Priority
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg py-1 hidden group-hover:block z-10">
            {(['low', 'medium', 'high', 'critical'] as JobPriority[]).map(p => (
              <label key={p} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.priorities.includes(p)}
                  onChange={(e) => {
                    const newP = e.target.checked
                      ? [...filters.priorities, p]
                      : filters.priorities.filter(item => item !== p);
                    setFilter('priorities', newP);
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700 capitalize">{p}</span>
              </label>
            ))}
          </div>
        </div>

        <button 
          onClick={() => setFilter('hasResume', filters.hasResume === true ? null : true)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors
            ${filters.hasResume === true ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
        >
          Has Resume
        </button>

        <div className="h-6 w-px bg-gray-200 mx-2" />

        <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors">
          Quick filters
          <ChevronDown className="w-4 h-4" />
        </button>

        <button 
          onClick={onClear}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 ml-auto"
        >
          Clear all
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="text-xs font-bold text-gray-500 mr-1 uppercase">Group by:</label>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm font-medium text-gray-700 transition-colors">
          Status
          <ChevronDown className="w-4 h-4" />
        </button>
        <div className="flex items-center border border-gray-200 rounded overflow-hidden">
          <button className="p-1.5 bg-gray-100 text-gray-900 border-r border-gray-200">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-gray-50 text-gray-500">
            <ListFilter className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-gray-50 text-gray-500 border-l border-gray-200">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
