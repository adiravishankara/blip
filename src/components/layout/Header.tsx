import { useAuth } from '../../context/AuthContext';
import { Search, Bell, Settings, HelpCircle, Grid } from 'lucide-react';

interface HeaderProps {
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  onCreateClick?: () => void;
}

export function Header({ onSearchChange, searchValue, onCreateClick }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 cursor-pointer">
          <Grid className="w-5 h-5 text-gray-600" />
          <div className="flex items-center gap-1.5">
            <div className="bg-blue-600 w-6 h-6 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <span className="font-bold text-gray-800 text-lg tracking-tight">blip</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-4 h-full">
          {['Everything', 'Projects', 'Filters', 'Dashboards', 'People', 'Apps'].map((item) => (
            <button
              key={item}
              className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors py-1 px-2 rounded hover:bg-gray-100"
            >
              {item}
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
            <button key={i} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        <div className="group relative">
          <button className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded transition-colors">
            <div className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase">
              {user?.email?.charAt(0) || 'U'}
            </div>
          </button>
          
          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1 hidden group-hover:block animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">ACCOUNT</p>
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Profile</button>
            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Settings</button>
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button 
                onClick={signOut}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
