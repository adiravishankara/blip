import { useMemo, useState, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  Briefcase, CheckCircle2, Clock, FileText, 
  TrendingUp, MapPin, ChevronRight, ArrowUpRight,
  Filter
} from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Job, JobStatus } from '../types';
import { supabase } from '../lib/supabase';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface HomeViewProps {
  jobs: Job[];
  onViewBoard: () => void;
  onSelectJob: (job: Job) => void;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function HomeView({ jobs, onViewBoard, onSelectJob }: HomeViewProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [mapFilter, setMapFilter] = useState<JobStatus | 'all'>('all');
  const [statusTimeFilter, setStatusTimeFilter] = useState<'all' | 'week' | 'month' | 'year'>('all');

  const statusData = useMemo(() => {
    let filteredJobs = jobs;
    const now = new Date();

    if (statusTimeFilter !== 'all') {
      filteredJobs = jobs.filter(j => {
        const jobDate = new Date(j.created_at || j.date_added);
        const diffDays = (now.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24); 
        
        if (statusTimeFilter === 'week') return diffDays <= 7;
        if (statusTimeFilter === 'month') return diffDays <= 30;
        if (statusTimeFilter === 'year') return diffDays <= 365;
        return true;
      });
    }

    const counts: Record<string, number> = {
      'Saved': 0,
      'Applying': 0,
      'Applied': 0,
      'Interviewing': 0,
      'Accepted': 0,
      'Rejected': 0,
      'Ghosted': 0
    };

    filteredJobs.forEach(j => {
      const statusLabel = j.status.charAt(0).toUpperCase() + j.status.slice(1);
      if (counts[statusLabel] !== undefined) {
        counts[statusLabel]++;
      }
    });

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [jobs, statusTimeFilter]);

  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from('job_status_history')
        .select('*')
        .order('changed_at', { ascending: true });
      setHistory(data || []);
    }
    loadHistory();
  }, []);

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      applied: jobs.filter(j => j.status === 'applied').length,
      backlog: jobs.filter(j => j.status === 'saved').length,
      interviewing: jobs.filter(j => j.status === 'interviewing').length,
      offers: jobs.filter(j => j.status === 'accepted').length,
    };
  }, [jobs]);

  const timelineData = useMemo(() => {
    // Last 14 days
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return d.toISOString().split('T')[0];
    });

    return days.map(day => {
      const count = history.filter(h => 
        h.to_status === 'applied' && 
        h.changed_at.startsWith(day)
      ).length;
      return { day: day.split('-').slice(1).join('/'), count };
    });
  }, [history]);

  const roleData = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach(j => {
      const role = j.job_title || 'Other';
      // Simple normalization: take first word or common title
      const normalized = role.split(' ')[0]; 
      counts[normalized] = (counts[normalized] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [jobs]);

  const topApplying = useMemo(() => {
    return jobs
      .filter(j => j.status === 'applying')
      .sort((a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime())
      .slice(0, 3);
  }, [jobs]);

  const topBacklog = useMemo(() => {
    return jobs
      .filter(j => j.status === 'saved')
      .sort((a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime())
      .slice(0, 3);
  }, [jobs]);

  const mapLocations = useMemo(() => {
    const locations: Record<string, { lat: number; lng: number; count: number; name: string }> = {
      'Toronto': { lat: 43.6532, lng: -79.3832, count: 0, name: 'Toronto' },
      'San Francisco': { lat: 37.7749, lng: -122.4194, count: 0, name: 'San Francisco' },
      'New York': { lat: 40.7128, lng: -74.0060, count: 0, name: 'New York' },
      'London': { lat: 51.5074, lng: -0.1278, count: 0, name: 'London' },
      'Austin': { lat: 30.2672, lng: -97.7431, count: 0, name: 'Austin' },
      'Seattle': { lat: 47.6062, lng: -122.3321, count: 0, name: 'Seattle' },
      'Boston': { lat: 42.3601, lng: -71.0589, count: 0, name: 'Boston' },
      'Chicago': { lat: 41.8781, lng: -87.6298, count: 0, name: 'Chicago' },
      'Los Angeles': { lat: 34.0522, lng: -118.2437, count: 0, name: 'LA' },
      'Vancouver': { lat: 49.2827, lng: -123.1207, count: 0, name: 'Vancouver' },
      'Remote': { lat: 0, lng: 0, count: 0, name: 'Remote' },
    };

    jobs.forEach(j => {
      if (mapFilter !== 'all' && j.status !== mapFilter) return;
      
      const loc = j.location?.toLowerCase() || '';
      for (const key in locations) {
        if (loc.includes(key.toLowerCase())) {
          locations[key].count++;
          break;
        }
      }
    });

    return Object.values(locations).filter(l => l.count > 0 && l.name !== 'Remote');
  }, [jobs, mapFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Welcome back!</h2>
          <p className="text-gray-500 mt-1">Here's what's happening with your job search today.</p>
        </div>
        <button 
          onClick={onViewBoard}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          View Kanban Board
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Applied" 
          value={stats.applied} 
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />} 
          color="bg-emerald-50"
          trend="+2 this week"
        />
        <StatCard 
          title="In Backlog" 
          value={stats.backlog} 
          icon={<Clock className="w-6 h-6 text-amber-600" />} 
          color="bg-amber-50"
          trend="Action needed"
        />
        <StatCard 
          title="Interviewing" 
          value={stats.interviewing} 
          icon={<Briefcase className="w-6 h-6 text-blue-600" />} 
          color="bg-blue-50"
          trend="3 upcoming"
        />
        <StatCard 
          title="Offers" 
          value={stats.offers} 
          icon={<FileText className="w-6 h-6 text-purple-600" />} 
          color="bg-purple-50"
          trend="Congrats!"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Main Chart - Timeline */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Application Momentum
            </h3>
            <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full">Past 14 days</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#9ca3af', fontSize: 12}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#9ca3af', fontSize: 12}} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900">Pipeline Status</h3>
            <select 
              className="text-xs font-medium border-none bg-gray-50 rounded-lg py-1 px-2 focus:ring-0 active:bg-gray-100 cursor-pointer"
              value={statusTimeFilter}
              onChange={(e) => setStatusTimeFilter(e.target.value as any)}
            >
              <option value="all">All Time</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="year">Past Year</option>
            </select>
          </div>
          <div className="h-[250px] w-full flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <div className="text-gray-400 text-sm">No data for this time period</div>
            )}
          </div>
          {statusData.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3">
              {statusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between text-sm pr-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-gray-600 truncate" title={entry.name}>{entry.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900 ml-2">{entry.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <h3 className="font-bold text-gray-900 mb-6">Role Distribution</h3>
          <div className="h-[250px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {roleData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {roleData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-gray-600">{entry.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lists Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Next to Prepare
              </h3>
              <span className="text-xs text-gray-500 font-medium font-mono uppercase">Oldest First</span>
            </div>
            <div className="space-y-3">
              {topApplying.map(job => (
                <JobRow key={job.id} job={job} onClick={() => onSelectJob(job)} />
              ))}
              {topApplying.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">No jobs in preparation</div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                From the Backlog
              </h3>
              <span className="text-xs text-gray-500 font-medium font-mono uppercase">Oldest First</span>
            </div>
            <div className="space-y-3">
              {topBacklog.map(job => (
                <JobRow key={job.id} job={job} onClick={() => onSelectJob(job)} />
              ))}
              {topBacklog.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">Backlog is empty</div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Map Section */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-500" />
              Global Reach
            </h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select 
                className="text-xs font-medium border-none bg-gray-50 rounded-lg py-1 px-2 focus:ring-0 active:bg-gray-100"
                value={mapFilter}
                onChange={(e) => setMapFilter(e.target.value as any)}
              >
                <option value="all">All Stages</option>
                <option value="saved">Backlog</option>
                <option value="applying">Preparing</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="accepted">Offered</option>
              </select>
            </div>
          </div>
          
          <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden relative min-h-[300px] border border-gray-200">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                center: [0, 20],
                scale: 120
              }}
              className="w-full h-full"
            >
              <Geographies geography={geoUrl}>
                {({ geographies }: { geographies: Array<{ rsmKey: string; [k: string]: unknown }> }) =>
                  geographies.map((geo: { rsmKey: string; [k: string]: unknown }) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#e5e7eb"
                      stroke="#d1d5db"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { fill: '#d1d5db', outline: 'none' },
                        pressed: { outline: 'none' }
                      }}
                    />
                  ))
                }
              </Geographies>
              {mapLocations.map((loc) => (
                <Marker key={loc.name} coordinates={[loc.lng, loc.lat]}>
                  <g>
                    <circle r={8} fill="#6366f1" stroke="#fff" strokeWidth={2} />
                    <text
                      textAnchor="middle"
                      y={20}
                      fontSize={10}
                      fontWeight="bold"
                      fill="#4338ca"
                    >
                      {loc.count}
                    </text>
                  </g>
                </Marker>
              ))}
            </ComposableMap>

            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg border border-gray-200 shadow-sm text-[10px] text-gray-600 max-w-[220px]">
              💡 You have {jobs.filter(j => j.location).length} jobs with location data across {mapLocations.length} major cities.
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function StatCard({ title, value, icon, color, trend }: { title: string, value: number, icon: React.ReactNode, color: string, trend?: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-xl`}>
          {icon}
        </div>
        {trend && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{trend}</span>}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function JobRow({ job, onClick }: { job: Job, onClick: () => void }) {
  const days = Math.floor((new Date().getTime() - new Date(job.date_added).getTime()) / (1000 * 3600 * 24));
  
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-colors text-xs">
          {job.company?.[0]?.toUpperCase() || 'J'}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-900 leading-tight">{job.job_title}</h4>
          <p className="text-xs text-gray-500">{job.company}</p>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <div className="text-[10px] font-bold text-gray-400 uppercase">{days === 0 ? 'Today' : `${days}d ago`}</div>
        <ArrowUpRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
