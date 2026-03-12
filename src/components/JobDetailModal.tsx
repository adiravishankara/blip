import { useState, useEffect, useRef } from 'react';
import { Job, JobStatus, JobComment, JobPriority, WorkMode, JobStatusHistoryEntry } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { resolveResumeUrl } from '../utils/storage';
import {
  X, ExternalLink, Send,
  FileText, MoreVertical, Trash2, Copy,
  User, Link2, ClipboardList, ChevronDown, ChevronUp,
  Share2, Eye, Bolt
} from 'lucide-react';

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'applying', label: 'Applying' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'ghosted', label: 'Ghosted' },
];

const PRIORITY_OPTIONS: { value: JobPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const WORK_MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

const STATUS_COLORS: Record<JobStatus, string> = {
  saved: 'bg-slate-100 text-slate-700',
  applying: 'bg-amber-100 text-amber-700',
  applied: 'bg-blue-100 text-blue-700',
  interviewing: 'bg-purple-100 text-purple-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  ghosted: 'bg-orange-100 text-orange-700',
};

// ---------------------------------------------------------------------------
// Inline-editable field for the Sidebar Grid
// ---------------------------------------------------------------------------
interface EditableGridFieldProps {
  label: string;
  value?: string | null;
  placeholder?: string;
  type?: 'text' | 'date' | 'number' | 'url';
  onSave: (value: string) => void;
}

function EditableGridField({ label, value, placeholder = 'None', type = 'text', onSave }: EditableGridFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      e.stopPropagation();
      setEditing(false);
      setDraft(value ?? '');
    }
  };

  return (
    <div className="grid grid-cols-[120px_1fr] items-center py-1.5 group/field">
      <span className="text-[13px] font-medium text-slate-500">{label}</span>
      <div className="min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full text-[13px] text-slate-900 border border-blue-400 rounded px-2 py-0.5 outline-none bg-white shadow-sm"
          />
        ) : (
          <div
            onClick={() => { setDraft(value ?? ''); setEditing(true); }}
            className="text-[13px] text-slate-900 cursor-pointer rounded px-2 py-0.5 -ml-2 hover:bg-slate-100 transition truncate min-h-[24px] flex items-center group-hover/field:text-blue-600"
          >
            {value ? <span>{value}</span> : <span className="text-slate-400">{placeholder}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section (Accordion)
// ---------------------------------------------------------------------------
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100 last:border-0 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          {icon}
          {title}
        </span>
      </button>
      {isOpen && <div className="mt-4 pl-6 text-sm text-slate-600 leading-relaxed">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline-editable field for the Main Area
// ---------------------------------------------------------------------------
interface EditableMainFieldProps {
  label: string;
  value?: string | null;
  placeholder?: string;
  type?: 'text' | 'url';
  icon?: React.ReactNode;
  onSave: (value: string) => void;
}

function EditableMainField({ label, value, placeholder = '—', type = 'text', icon, onSave }: EditableMainFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      e.stopPropagation();
      setEditing(false);
      setDraft(value ?? '');
    }
  };

  return (
    <div className="mb-4 last:mb-0 group/main-field">
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {icon}
        {label}
      </label>
      {editing ? (
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full text-sm text-slate-900 border border-blue-400 rounded px-3 py-1.5 outline-none bg-white shadow-sm"
        />
      ) : (
        <div 
          onClick={() => { setDraft(value ?? ''); setEditing(true); }}
          className="text-sm text-slate-700 cursor-pointer rounded px-3 py-1.5 -ml-3 hover:bg-slate-50 transition border border-transparent hover:border-slate-200 min-h-[36px] flex items-center group-hover/main-field:text-blue-600"
        >
          {value ? (
            <span className="truncate flex items-center gap-2">
              {type === 'url' && <Link2 className="w-3.5 h-3.5 text-slate-400" />}
              {value}
              {type === 'url' && (
                <a 
                  href={value} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 hover:bg-blue-100 rounded text-blue-500"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </span>
          ) : (
            <span className="text-slate-400 italic">{placeholder}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main JobDetailModal
// ---------------------------------------------------------------------------
export function JobDetailModal({ job, onClose, onUpdate }: JobDetailModalProps) {
  const { user } = useAuth();
  const [localJob, setLocalJob] = useState<Job>(job);
  const [comments, setComments] = useState<JobComment[]>([]);
  const [statusHistory, setStatusHistory] = useState<JobStatusHistoryEntry[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'history'>('activity');
  const settingsRef = useRef<HTMLDivElement>(null);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  
  // Header Editing States
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);

  useEffect(() => {
    loadComments();
    loadStatusHistory();
  }, [job.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const loadComments = async () => {
    const { data } = await supabase
      .from('job_comments')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  const loadStatusHistory = async () => {
    const { data } = await supabase
      .from('job_status_history')
      .select('*')
      .eq('job_id', job.id)
      .order('changed_at', { ascending: true });
    setStatusHistory(data || []);
  };

  const updateField = async (fields: Partial<Job>) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update(fields)
        .eq('id', localJob.id);
      if (error) throw error;
      setLocalJob(prev => ({ ...prev, ...fields }));
      onUpdate();
    } catch (err) {
      console.error('Error updating job:', err);
    }
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    await updateField({ status: newStatus });
    setTimeout(loadStatusHistory, 400);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
      const { error } = await supabase.from('job_comments').insert({
        job_id: localJob.id,
        user_id: user!.id,
        comment: newComment,
      });
      if (error) throw error;
      setNewComment('');
      loadComments();
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    setShowSettings(false);
    if (!confirm('Are you sure you want to delete this job?')) return;
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', localJob.id);
      if (error) throw error;
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error deleting job:', err);
    }
  };

  const shortId = localJob.id.split('-')[0].toUpperCase();

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-[1240px] h-[90vh] overflow-hidden flex flex-col font-sans">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <span>Spaces</span>
              <span className="mx-0.5 text-slate-300">/</span>
              <span>Job</span>
              <span className="mx-0.5 text-slate-300">/</span>
              <span className="text-slate-900 font-bold uppercase tracking-widest">{shortId}</span>
              <button className="p-1 hover:bg-slate-100 rounded transition ml-1"><Link2 className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1.5 hover:bg-slate-100 rounded transition text-slate-500"><Eye className="w-4 h-4" /></button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition text-slate-500"><Share2 className="w-4 h-4" /></button>
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 hover:bg-slate-100 rounded transition text-slate-500"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded shadow-xl z-20 py-1">
                  <button onClick={() => { navigator.clipboard.writeText(localJob.job_url || ''); setShowSettings(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </button>
                  <button onClick={handleDeleteJob} className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-rose-600 hover:bg-rose-50">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Job
                  </button>
                </div>
              )}
            </div>
            <div className="w-[1px] h-4 bg-slate-200 mx-1" />
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded transition text-slate-500"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* Main Area */}
          <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
            
            {/* Title & Company Info (Editable) */}
            <div className="mb-6 group/header-meta">
              {isEditingTitle ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={localJob.job_title}
                  onBlur={async e => {
                    setIsEditingTitle(false);
                    const val = e.target.value.trim();
                    if (val && val !== localJob.job_title) await updateField({ job_title: val });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setIsEditingTitle(false);
                    }
                  }}
                  className="text-2xl font-bold text-slate-900 mb-2 w-full border-b border-blue-400 outline-none"
                />
              ) : (
                <h1 
                  onClick={() => setIsEditingTitle(true)}
                  className="text-2xl font-bold text-slate-900 mb-2 cursor-pointer hover:bg-slate-50 rounded px-1 -ml-1 transition"
                >
                  {localJob.job_title}
                </h1>
              )}

              <div className="flex items-center gap-2 text-sm text-slate-500">
                {isEditingCompany ? (
                  <input
                    autoFocus
                    type="text"
                    defaultValue={localJob.company}
                    onBlur={async e => {
                      setIsEditingCompany(false);
                      const val = e.target.value.trim();
                      if (val && val !== localJob.company) await updateField({ company: val });
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setIsEditingCompany(false);
                      }
                    }}
                    className="font-medium text-slate-700 border-b border-blue-400 outline-none"
                  />
                ) : (
                  <span 
                    onClick={() => setIsEditingCompany(true)}
                    className="font-medium text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1 -ml-1 transition"
                  >
                    {localJob.company}
                  </span>
                )}
                
                <span>•</span>
                
                {isEditingUrl ? (
                  <input
                    autoFocus
                    type="url"
                    defaultValue={localJob.job_url ?? ''}
                    onBlur={async e => {
                      setIsEditingUrl(false);
                      const val = e.target.value.trim();
                      if (val !== (localJob.job_url ?? '')) await updateField({ job_url: val || null });
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setIsEditingUrl(false);
                      }
                    }}
                    className="text-blue-600 border-b border-blue-400 outline-none min-w-[200px]"
                    placeholder="Enter JD Link..."
                  />
                ) : (
                  <div 
                    onClick={() => setIsEditingUrl(true)}
                    className="flex items-center gap-1 cursor-pointer hover:bg-slate-50 rounded px-1 transition"
                  >
                    {localJob.job_url ? (
                      <div className="flex items-center gap-1">
                        <a 
                          href={localJob.job_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline font-medium flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          JD Link
                        </a>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No link added</span>
                    )}
                  </div>
                )}

                <span>•</span>
                <span className="text-xs">{Math.floor((new Date().getTime() - new Date(localJob.date_added).getTime()) / (1000 * 60 * 60 * 24))}d ago</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-8">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[13px] font-medium transition">
                <Plus className="w-3.5 h-3.5" /> Add child work item
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[13px] font-medium transition">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>

            <CollapsibleSection title="Description" icon={<FileText className="w-4 h-4 text-slate-500" />}>
              <div
                onClick={() => setIsEditingDesc(true)}
                className={`p-3 rounded-md transition-all cursor-text min-h-[4rem] group/desc border ${
                  isEditingDesc ? 'border-blue-400 bg-white' : 'border-transparent hover:bg-slate-50'
                }`}
              >
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      defaultValue={localJob.job_description ?? ''}
                      onBlur={async e => {
                        setIsEditingDesc(false);
                        const val = e.target.value.trim();
                        if (val !== (localJob.job_description ?? '')) await updateField({ job_description: val || null });
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          setIsEditingDesc(false);
                        }
                      }}
                      className="w-full text-sm outline-none bg-transparent resize-y"
                      rows={6}
                    />
                    <div className="flex justify-end gap-2 text-[11px] text-slate-400">Press Esc to cancel</div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {localJob.job_description || <span className="text-slate-400 italic">Add a description...</span>}
                  </p>
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Links" icon={<Link2 className="w-4 h-4 text-slate-500" />} defaultOpen={true}>
              <div className="p-2 space-y-4">
                <EditableMainField 
                  label="Resume Link"
                  value={localJob.resume_link}
                  placeholder="Paste resume URL here..."
                  type="url"
                  onSave={v => updateField({ resume_link: v || null })}
                />
                {localJob.resume_link && !localJob.resume_link.startsWith('http') && (
                  <div className="px-3 mb-2">
                    <a 
                      href={resolveResumeUrl(localJob.resume_link)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" /> View Uploaded Resume
                    </a>
                  </div>
                )}
                <EditableMainField 
                  label="Cover Letter Link"
                  value={localJob.cover_letter_link}
                  placeholder="Paste cover letter URL here..."
                  type="url"
                  onSave={v => updateField({ cover_letter_link: v || null })}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Notes" icon={<ClipboardList className="w-4 h-4 text-slate-500" />} defaultOpen={false}>
              <div
                onClick={() => setIsEditingNotes(true)}
                className={`p-3 rounded-md transition-all cursor-text min-h-[4rem] group/notes border ${
                  isEditingNotes ? 'border-blue-400 bg-white' : 'border-transparent hover:bg-slate-50'
                }`}
              >
                {isEditingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      defaultValue={localJob.notes ?? ''}
                      onBlur={async e => {
                        setIsEditingNotes(false);
                        const val = e.target.value.trim();
                        if (val !== (localJob.notes ?? '')) await updateField({ notes: val || null });
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          setIsEditingNotes(false);
                        }
                      }}
                      className="w-full text-sm outline-none bg-transparent resize-y"
                      rows={6}
                    />
                    <div className="flex justify-end gap-2 text-[11px] text-slate-400">Press Esc to cancel</div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {localJob.notes || <span className="text-slate-400 italic">Add notes...</span>}
                  </p>
                )}
              </div>
            </CollapsibleSection>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex items-center gap-6 mb-6 border-b border-slate-100">
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`pb-2 text-[13px] font-semibold transition ${
                    activeTab === 'activity' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Activity
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`pb-2 text-[13px] font-semibold transition ${
                    activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  History
                </button>
              </div>

              {activeTab === 'activity' ? (
                <div className="space-y-6">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <form onSubmit={handleAddComment} className="flex-1 relative group/form">
                      <input
                        type="text"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="w-full px-4 py-2 border border-slate-200 rounded text-sm focus:border-blue-400 outline-none transition"
                      />
                      <button
                        type="submit"
                        disabled={commentLoading || !newComment.trim()}
                        className="absolute right-2 top-1.5 p-1 text-blue-500 hover:bg-blue-50 rounded disabled:opacity-0 transition"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                  <div className="space-y-5">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-semibold text-slate-900">User</span>
                            <span className="text-[11px] text-slate-400">{new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                          <p className="text-[13px] text-slate-700 bg-slate-50 px-3 py-2 rounded-md border border-slate-100">{c.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {statusHistory.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-slate-300" />
                      <div>
                        <div className="text-[13px] text-slate-600">
                          {entry.from_status ? (
                            <>
                              Changed status from <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${STATUS_COLORS[entry.from_status as JobStatus]}`}>{entry.from_status}</span> to <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${STATUS_COLORS[entry.to_status as JobStatus]}`}>{entry.to_status}</span>
                            </>
                          ) : (
                            <>Added with status <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${STATUS_COLORS[entry.to_status as JobStatus]}`}>{entry.to_status}</span></>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{new Date(entry.changed_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-[380px] border-l border-slate-100 overflow-y-auto px-6 py-6 bg-white">
            <div className="mb-8">
              <select
                value={localJob.status}
                onChange={e => handleStatusChange(e.target.value as JobStatus)}
                className={`w-fit px-3 py-1.5 rounded text-[13px] font-bold outline-none cursor-pointer transition shadow-sm ${STATUS_COLORS[localJob.status]}`}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>)}
              </select>
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                <span className="flex items-center gap-2 text-[12px] font-bold text-slate-600 uppercase tracking-widest">
                  <ChevronDown className="w-3.5 h-3.5" /> Details
                </span>
                <Bolt className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="p-4 space-y-1">
                <div className="grid grid-cols-[120px_1fr] items-center py-1.5">
                  <span className="text-[13px] font-medium text-slate-500">Priority</span>
                  <select
                    value={localJob.priority}
                    onChange={e => updateField({ priority: e.target.value as JobPriority })}
                    className="w-fit text-[13px] font-semibold text-slate-800 outline-none hover:bg-slate-100 px-2 py-0.5 rounded transition"
                  >
                    {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center py-1.5">
                  <span className="text-[13px] font-medium text-slate-500">Work Mode</span>
                  <select
                    value={localJob.work_mode ?? ''}
                    onChange={e => updateField({ work_mode: (e.target.value || null) as WorkMode | undefined })}
                    className="w-fit text-[13px] font-medium text-slate-800 outline-none hover:bg-slate-100 px-2 py-0.5 rounded transition"
                  >
                    <option value="">None</option>
                    {WORK_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <EditableGridField
                  label="Location"
                  value={localJob.location}
                  onSave={v => updateField({ location: v || null })}
                />

                <EditableGridField
                  label="Compensation"
                  value={localJob.pay_scale}
                  onSave={v => updateField({ pay_scale: v || null })}
                />

                <EditableGridField
                  label="Offer Amount"
                  value={localJob.offer_amount?.toString()}
                  placeholder="None"
                  type="number"
                  onSave={v => updateField({ offer_amount: v ? Number(v) : null })}
                />

                <div className="h-4" />

                <EditableGridField
                  label="Deadline"
                  value={localJob.application_deadline}
                  type="date"
                  onSave={v => updateField({ application_deadline: v || null })}
                />

                <EditableGridField
                  label="Interview Date"
                  value={localJob.interview_date?.slice(0, 10)}
                  type="date"
                  onSave={v => updateField({ interview_date: v || null })}
                />

                <div className="h-4" />

                <EditableGridField
                  label="Team"
                  value={localJob.team}
                  onSave={v => updateField({ team: v || null })}
                />

                <EditableGridField
                  label="Contact"
                  value={localJob.contact_person}
                  onSave={v => updateField({ contact_person: v || null })}
                />

                <EditableGridField
                  label="Referred By"
                  value={localJob.referred_by}
                  onSave={v => updateField({ referred_by: v || null })}
                />

                <div className="h-4" />

                <div className="grid grid-cols-[120px_1fr] py-1.5">
                  <span className="text-[13px] font-medium text-slate-500 uppercase text-[10px] tracking-wider">Keywords</span>
                  <div className="flex flex-wrap gap-1">
                    {localJob.keywords?.map((k, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-semibold rounded lowercase border border-slate-200">{k}</span>
                    ))}
                    {!localJob.keywords?.length && <span className="text-[12px] text-slate-400 italic">None</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-8 text-[11px] text-slate-400 text-center uppercase tracking-widest">
              Created {new Date(localJob.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Plus = ({ className }: { className?: string }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
