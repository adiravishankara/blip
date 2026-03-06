import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ChevronRight, ChevronLeft, Upload, Check } from 'lucide-react';
import { CityAutocomplete } from './CityAutocomplete';

interface OnboardingModalProps {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: user?.email || '',
    location: '',
    role_type: '',
    resume_links: [] as { label: string; url: string }[]
  });

  const [resumes, setResumes] = useState<{ label: string; file: File }[]>([]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const uploadResumes = async (userId: string) => {
    const uploadedLinks = [];
    for (const item of resumes) {
      const fileExt = item.file.name.split('.').pop();
      const fileName = `${userId}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      
      console.log('Attempting upload to bucket "resumes":', fileName);
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(fileName, item.file);

      if (error) {
        console.error('Storage upload error details:', {
          message: error.message,
          error: error
        });
        throw error;
      }
      
      console.log('Upload success:', data?.path);
      uploadedLinks.push({
        label: item.label,
        url: fileName // Storing the bucket path
      });
    }
    return uploadedLinks;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Upload files first
      console.log('Starting resume uploads for user:', user.id);
      const uploadedLinks = await uploadResumes(user.id);
      console.log('Uploads completed:', uploadedLinks);

      // 2. Upsert profile
      const profileData = {
        user_id: user.id,
        full_name: formData.full_name,
        email: formData.email,
        preferred_locations: [formData.location],
        role_type: formData.role_type,
        resume_links: uploadedLinks,
        updated_at: new Date().toISOString()
      };
      
      console.log('Upserting profile data:', profileData);
      
      const { error, status, statusText } = await supabase
        .from('user_profiles')
        .upsert(profileData, { onConflict: 'user_id' });

      if (error) {
        console.error('Supabase upsert failure details:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details,
          status,
          statusText
        });
        throw error;
      }
      
      console.log('Profile saved successfully');
      await refreshProfile();
      onComplete();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert(`Failed to save profile: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const label = prompt('Give this resume a label (e.g. "Software Engineer")', 'Main Resume');
      if (label) {
        setResumes(prev => [...prev, { label, file }]);
      }
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome to blip!</h2>
            <p className="text-gray-500 mt-1">Let's set up your profile to get started.</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-blue-600' : 'bg-gray-200'}`} 
              />
            ))}
          </div>
        </div>

        <div className="px-8 py-6">
          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                  value={formData.email}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Your Location</label>
                <CityAutocomplete
                  onSelect={(location) => setFormData({ ...formData, location })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  placeholder="e.g. San Francisco, CA"
                />
                <p className="mt-1.5 text-[11px] text-gray-400">Start typing your city name (min 3 chars)</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role Type</label>
                <select
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.role_type}
                  onChange={e => setFormData({ ...formData, role_type: e.target.value })}
                >
                  <option value="">Select a role...</option>
                  <option value="Software Engineer">Software Engineer</option>
                  <option value="Product Manager">Product Manager</option>
                  <option value="Designer">Designer</option>
                  <option value="Data Scientist">Data Scientist</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <label className="block text-sm font-semibold text-gray-700">Resumes</label>
              <div className="space-y-3">
                {resumes.map((resume, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">{resume.label}</p>
                        <p className="text-xs text-blue-600 truncate max-w-[200px]">{resume.file.name}</p>
                      </div>
                    </div>
                    <Check className="w-5 h-5 text-blue-600" />
                  </div>
                ))}
                
                {resumes.length < 3 && (
                  <label className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group block">
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-100 transition-colors">
                      <Upload className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 group-hover:text-blue-700">Click to upload resume</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOC up to 5MB</p>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-4 flex gap-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={step === 3 ? handleSubmit : handleNext}
            disabled={loading || (step === 1 && !formData.full_name) || (step === 2 && (!formData.location || !formData.role_type))}
            className="flex-[2] flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {step === 3 ? 'Get Started' : 'Next Step'}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
