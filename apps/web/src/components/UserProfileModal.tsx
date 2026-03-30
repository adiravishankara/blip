import { useState, useEffect } from 'react';
import { UserProfile, ResumeLink, WorkModePreference } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { resolveResumeUrl } from '../utils/storage';
import { extractPdfText } from '../services/pdfText';
import { embedText } from '../services/embeddings';
import { CityAutocomplete } from './CityAutocomplete';
import {
  X, Plus, Trash2, Save, User, MapPin, DollarSign, Briefcase,
  Link2, FileText, Loader2, Upload,
} from 'lucide-react';

interface UserProfileModalProps {
  onClose: () => void;
}

const WORK_MODE_OPTIONS: { value: WorkModePreference; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote only' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

const emptyProfile = (userId: string): Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> => ({
  user_id: userId,
  display_name: '',
  full_name: '',
  role_type: '',
  target_roles: [],
  preferred_locations: [],
  min_salary: undefined,
  work_mode_preference: 'any',
  resume_links: [],
  bio: '',
});

// ---------------------------------------------------------------------------
// Tag-chip input (for string arrays)
// ---------------------------------------------------------------------------
interface TagInputProps {
  label: string;
  tags: string[];
  placeholder: string;
  icon?: React.ReactNode;
  onChange: (tags: string[]) => void;
}

function TagInput({ label, tags, placeholder, icon, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setDraft('');
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
        {icon}
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((t, i) => (
          <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
            {t}
            <button onClick={() => onChange(tags.filter((_, j) => j !== i))} className="hover:text-red-500 transition">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function UserProfileModal({ onClose }: UserProfileModalProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>(
    emptyProfile(user!.id)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newResume, setNewResume] = useState<ResumeLink>({ label: '', url: '' });
  const [saved, setSaved] = useState(false);
  const [resumeVersions, setResumeVersions] = useState<any[]>([]);
  const [resumeVersionLabel, setResumeVersionLabel] = useState('Primary');
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    loadResumeVersions();
  }, []);

  useEffect(() => {
    // Escape key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error) {
        console.error('Supabase load profile error:', error);
        return;
      }

      if (data) {
        console.log('Profile loaded from DB:', data);
        setProfile({
          user_id: data.user_id,
          display_name: data.display_name || data.full_name || '',
          full_name: data.full_name ?? '',
          role_type: data.role_type ?? '',
          target_roles: data.target_roles ?? [],
          preferred_locations: data.preferred_locations ?? [],
          min_salary: data.min_salary ?? undefined,
          work_mode_preference: data.work_mode_preference ?? 'any',
          resume_links: data.resume_links ?? [],
          bio: data.bio ?? '',
        });
      }
    } catch (err) {
      console.error('Fatal loadProfile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadResumeVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('resume_versions')
        .select('id,label,storage_path,embedding_status,updated_at,created_at')
        .order('created_at', { ascending: false });

      if (error) return;
      setResumeVersions(data ?? []);
    } catch {
      // ignore for now; table may not exist until migrations applied
    }
  };

  const handleUploadResumePdf = async (file: File) => {
    if (!user) return;
    setUploadError(null);
    setUploadingResume(true);

    try {
      const id = crypto.randomUUID();
      const storagePath = `${user.id}/${id}/${file.name}`;
      const label = resumeVersionLabel.trim() || 'Resume';

      const { error: insertErr } = await supabase.from('resume_versions').insert({
        id,
        user_id: user.id,
        label,
        storage_path: storagePath,
        embedding_status: 'processing',
        embedding_model: 'gte-small',
      });
      if (insertErr) throw insertErr;

      const { error: uploadErr } = await supabase.storage.from('resumes').upload(storagePath, file, {
        upsert: true,
        contentType: 'application/pdf',
      });
      if (uploadErr) throw uploadErr;

      const extractedText = await extractPdfText(file);
      const { embedding, model } = await embedText(extractedText.slice(0, 20_000));

      const { error: embErr } = await supabase.from('resume_version_embeddings').upsert({
        resume_version_id: id,
        model,
        embedding,
        updated_at: new Date().toISOString(),
      });
      if (embErr) throw embErr;

      const { error: updateErr } = await supabase
        .from('resume_versions')
        .update({
          extracted_text: extractedText,
          embedding_status: 'ready',
          embedding_model: model,
        })
        .eq('id', id);
      if (updateErr) throw updateErr;

      await loadResumeVersions();
    } catch (err: any) {
      setUploadError(err?.message ?? 'Failed to upload resume.');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...profile,
        min_salary: profile.min_salary || null,
        updated_at: new Date().toISOString()
      };
      
      console.log('Saving profile payload:', payload);

      const { error, status } = await supabase
        .from('user_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.error('Save failed details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          status
        });
        throw error;
      }
      
      console.log('Save success:', status);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      alert(`Error saving profile: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const addResumeLink = () => {
    if (!newResume.label.trim() || !newResume.url.trim()) return;
    setProfile(p => ({ ...p, resume_links: [...(p.resume_links ?? []), newResume] }));
    setNewResume({ label: '', url: '' });
  };

  const removeResumeLink = (i: number) => {
    setProfile(p => ({ ...p, resume_links: (p.resume_links ?? []).filter((_, j) => j !== i) }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
            <p className="text-sm text-gray-500 mt-0.5">Used for job filtering and match scoring</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <form
            className="overflow-y-auto p-6 space-y-8"
            onSubmit={e => { e.preventDefault(); handleSave(); }}
          >
            {/* Personal */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4" /> Personal Info
              </h3>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={profile.full_name ?? ''}
                  onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-medium"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Display Name (Public)</label>
                  <input
                    type="text"
                    value={profile.display_name ?? ''}
                    onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))}
                    placeholder="Preferred name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Current Role / Type</label>
                  <input
                    type="text"
                    value={profile.role_type ?? ''}
                    onChange={e => setProfile(p => ({ ...p, role_type: e.target.value }))}
                    placeholder="e.g. Software Engineer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Bio / Summary
                </label>
                <textarea
                  value={profile.bio ?? ''}
                  onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                  rows={3}
                  placeholder="Short blurb about yourself…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </section>

            {/* Job Preferences */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Job Preferences
              </h3>

              <TagInput
                label="Target Roles"
                tags={profile.target_roles ?? []}
                placeholder="e.g. Software Engineer"
                icon={<Briefcase className="w-3 h-3" />}
                onChange={v => setProfile(p => ({ ...p, target_roles: v }))}
              />

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                  <MapPin className="w-3 h-3" />
                  Preferred Locations
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(profile.preferred_locations ?? []).map((loc, i) => (
                    <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                      {loc}
                      <button onClick={() => setProfile(p => ({ ...p, preferred_locations: (p.preferred_locations ?? []).filter((_, j) => j !== i) }))} className="hover:text-red-500 transition">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <CityAutocomplete
                  key={profile.preferred_locations?.length ?? 0}
                  onSelect={(location) => {
                    const locs = profile.preferred_locations ?? [];
                    if (location && !locs.includes(location)) {
                      setProfile(p => ({ ...p, preferred_locations: [...(p.preferred_locations ?? []), location] }));
                    }
                  }}
                  placeholder="Type city name (min 3 chars)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Min Annual Salary (USD)
                  </label>
                  <input
                    type="number"
                    value={profile.min_salary ?? ''}
                    onChange={e => setProfile(p => ({ ...p, min_salary: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="e.g. 120000"
                    min={0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Work Mode Preference</label>
                  <select
                    value={profile.work_mode_preference ?? 'any'}
                    onChange={e => setProfile(p => ({ ...p, work_mode_preference: e.target.value as WorkModePreference }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 bg-white"
                  >
                    {WORK_MODE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Resumes */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Resume Versions (PDF)
              </h3>

              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Label</label>
                    <input
                      type="text"
                      value={resumeVersionLabel}
                      onChange={e => setResumeVersionLabel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400"
                      placeholder="e.g. Hardware Engineer v3"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition border cursor-pointer ${
                      uploadingResume ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    }`}>
                      {uploadingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingResume ? 'Uploading…' : 'Upload PDF'}
                      <input
                        type="file"
                        accept="application/pdf"
                        disabled={uploadingResume}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          void handleUploadResumePdf(f);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {uploadError && (
                  <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                    {uploadError}
                  </div>
                )}

                {(resumeVersions ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {resumeVersions.map((rv) => (
                      <div key={rv.id} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{rv.label}</div>
                          <div className="text-xs text-gray-500 truncate">{rv.embedding_status}</div>
                        </div>
                        <div className="text-xs text-gray-400 font-mono">{String(rv.id).slice(0, 8)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Upload at least one PDF resume to enable matching.</p>
                )}
              </div>

              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 pt-2">
                <Link2 className="w-4 h-4" /> Resume Links (legacy)
              </h3>

              {(profile.resume_links ?? []).length > 0 && (
                <div className="space-y-2">
                  {(profile.resume_links ?? []).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                        <a
                          href={resolveResumeUrl(r.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate block"
                        >
                          {r.url}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeResumeLink(i)}
                        className="p-1 hover:text-red-500 text-gray-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium">Add a resume link</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newResume.label}
                    onChange={e => setNewResume(r => ({ ...r, label: e.target.value }))}
                    placeholder="Label (e.g. SWE Resume)"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400"
                  />
                  <input
                    type="url"
                    value={newResume.url}
                    onChange={e => setNewResume(r => ({ ...r, url: e.target.value }))}
                    placeholder="https://…"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={addResumeLink}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </section>

            {/* Save */}
            <div className="pt-2 pb-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

