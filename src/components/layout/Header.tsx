import { useAuth } from '../../context/AuthContext';
import { Search, Bell, Settings, HelpCircle, Grid } from 'lucide-react';

interface HeaderProps {
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  onCreateClick?: () => void;
  onProfileClick?: () => void;
  userInitials?: string;
  currentTab: 'Dashboard' | 'Kanban board';
  onTabChange: (tab: 'Dashboard' | 'Kanban board') => void;
}

export function Header({ 
  onSearchChange, 
  searchValue, 
  onCreateClick, 
  onProfileClick,
  userInitials = 'U',
  currentTab,
  onTabChange
}: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 cursor-pointer">
          <img src="/dist/assets/blip_logo.png" alt="Blip Logo" className="w-16 h-16 object-contain" />
          {/* <span className="font-bold text-gray-800 text-lg tracking-tight">blip</span> */}
        </div>

        <nav className="hidden md:flex items-center gap-4 h-full ml-4">
          {(['Dashboard', 'Kanban board'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`font-medium text-sm transition-colors py-1.5 px-3 rounded-md ${
                tab === currentTab 
                  ? 'text-blue-700 bg-blue-50 font-semibold' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
          <button 
            onClick={onCreateClick}
            className="bg-blue-600 text-white px-3 py-1.5 rounded font-medium text-sm hover:bg-blue-700 transition-colors ml-2"
          >
            Create
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative mr-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search"
            className="pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-300 rounded focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm w-48 md:w-64"
          />
        </div>

        <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
          {[Bell, HelpCircle, Settings].map((Icon, i) => (
            <button 
              key={i} 
              onClick={Icon === Settings ? onProfileClick : undefined}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        <div className="group relative">
          <button className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded transition-colors focus:outline-none">
            <div className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase transition-transform group-hover:scale-105">
              {userInitials}
            </div>
          </button>
          
          {/* Dropdown with invisible bridge to prevent mouse-out */}
          <div className="absolute right-0 top-full pt-2 w-52 hidden group-hover:block animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-white border border-gray-200 rounded-xl shadow-2xl py-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Account</p>
                <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{user?.email}</p>
              </div>
              <div className="p-1">
                <button 
                  onClick={onProfileClick}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Grid className="w-4 h-4 text-gray-400" />
                  Profile
                </button>
                <button 
                  onClick={onProfileClick}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Settings
                </button>
              </div>
              <div className="border-t border-gray-100 mt-1 p-1">
                <button 
                  onClick={signOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-colors"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
