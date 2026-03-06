import { ChevronRight, Share2, Zap, Maximize2, MoreHorizontal } from 'lucide-react';

export function BoardHeader() {
  return (
    <div className="bg-white px-8 pt-4 pb-2">
      <nav className="flex items-center gap-1 text-xs text-gray-500 mb-2">
        <span>Workspaces</span>
        <ChevronRight className="w-3 h-3" />
        <span>Job Hunt</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Kanban Board</span>
      </nav>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Job Applications</h1>
          <div className="flex -space-x-1.5 ml-4">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold uppercase
                  ${i === 1 ? 'bg-indigo-500' : i === 2 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              >
                {i === 1 ? 'JD' : i === 2 ? 'AV' : 'RV'}
              </div>
            ))}
            <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-gray-600 text-[10px] font-bold">
              +5
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors">
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors">
            <Zap className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <MoreHorizontal className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex items-center border-b border-gray-200">
        {[
          'Summary', 
          'Timeline', 
          'Kanban board', 
          'Calendar', 
          'List', 
          'Forms', 
          'Reports'
        ].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === 'Kanban board' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}`}
          >
            {tab}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-4 mb-1">
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded font-bold uppercase py-0.5">NEW</span>
        </div>
      </div>
    </div>
  );
}
