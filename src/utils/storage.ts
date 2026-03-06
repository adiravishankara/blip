import { supabase } from '../lib/supabase';

/**
 * Resolves a resume URL. If the URL is a storage path (e.g. doesn't start with http),
 * it returns the public Supabase Storage URL.
 */
export function resolveResumeUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;

    const { data } = supabase.storage
        .from('resumes')
        .getPublicUrl(url);

    return data.publicUrl;
}
