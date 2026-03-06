import { Share2, Zap, Maximize2, MoreHorizontal } from 'lucide-react';

interface BoardHeaderProps {
  userInitials?: string;
  currentTab: 'Dashboard' | 'Kanban board';
  onTabChange: (tab: 'Dashboard' | 'Kanban board') => void;
}

export function BoardHeader({ userInitials = 'JD', currentTab, onTabChange }: BoardHeaderProps) {
  const tabs: ('Dashboard' | 'Kanban board')[] = ['Dashboard', 'Kanban board'];

  return (
    <div className="bg-white px-8 pt-4 pb-2">
      <nav className="flex items-center gap-1 text-xs text-gray-500 mb-2 font-medium">
        <span>Spaces</span>
        <span className="mx-1 text-gray-300">/</span>
        <span className="text-gray-900">{currentTab}</span>
      </nav>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {currentTab === 'Dashboard' ? 'Search Overview' : 'Job Applications'}
          </h1>
          <div className="flex ml-4">
            <div 
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold uppercase bg-indigo-500 shadow-sm"
            >
              {userInitials}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons removed for brevity or kept as is */}
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
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === currentTab 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
