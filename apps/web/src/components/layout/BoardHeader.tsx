import { Share2, Zap, Maximize2, MoreHorizontal, Download } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface BoardHeaderProps {
  userInitials?: string;
  currentTab: 'Dashboard' | 'Kanban board';
  onExportClick?: () => void;
}

export function BoardHeader({ userInitials = 'JD', currentTab, onExportClick }: BoardHeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-50 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    onExportClick?.();
                  }}
                  className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Selected
                </button>
              </div>
            )}
          </div>
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
    </div>
  );
}
