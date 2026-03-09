import { supabase } from '../lib/supabase';

export type ScrapingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ScrapingJob {
    id: string;
    user_id: string;
    url: string;
    status: ScrapingStatus;
    error?: string;
    data?: any;
    created_at: string;
}


// Use custom URL for self-hosted Firecrawl (e.g. http://localhost:3002), otherwise cloud API
const FIRECRAWL_API_URL = import.meta.env.VITE_FIRECRAWL_API_URL || 'https://api.firecrawl.dev/v2/scrape';
const API_KEY = import.meta.env.VITE_FIRECRAWL_API_KEY;

export interface ScrapedJobData {
    job_title: string;
    company_name: string;
    location?: string;
    compensation?: string;
    team_name?: string;
    description: string;
}

/**
 * Parses ScrapedJobData from Firecrawl markdown + metadata when JSON extraction is unavailable.
 */
function parseJobFromMarkdown(data: { markdown?: string; metadata?: Record<string, string> }): ScrapedJobData {
    const md = data.markdown ?? '';
    const meta = data.metadata ?? {};
    const title = meta.ogTitle ?? meta.title ?? '';
    const companyMatch = title.match(/\s+at\s+(.+)$/i);
    const company = companyMatch ? companyMatch[1].trim() : '';
    const jobTitle = (meta.ogTitle ?? title.replace(/\s+at\s+.*$/i, '').trim()) || 'Unknown';
    const location = meta.ogDescription ?? '';
    let compensation = '';
    const compMatch = md.match(/\$[\d,]+[-\s]*\$?[\d,]+/g);
    if (compMatch?.length) {
        compensation = compMatch.slice(0, 2).join('; ').replace(/\s+/g, ' ');
    }
    return {
        job_title: jobTitle,
        company_name: company || 'Unknown',
        location: location || undefined,
        compensation: compensation || undefined,
        team_name: undefined,
        description: md
    };
}

/**
 * Cleans a URL by removing tracking parameters.
 */
export function cleanJobUrl(url: string): string {
    try {
        // Return only the base part of the URL before any query parameters
        return url.split('?')[0];
    } catch (e) {
        return url;
    }
}

export async function extractJobFromUrl(url: string): Promise<ScrapedJobData> {
    const cleanedUrl = cleanJobUrl(url);

    // 1. Check cache
    const { data: cachedData } = await supabase
        .from('scraped_jobs')
        .select('*')
        .eq('url', cleanedUrl)
        .maybeSingle();

    if (cachedData) {
        const lastScraped = new Date(cachedData.last_scraped_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (lastScraped > thirtyDaysAgo) {
            console.log('Using cached scraping result for:', cleanedUrl);
            return {
                job_title: cachedData.job_title,
                company_name: cachedData.company_name,
                location: cachedData.location,
                compensation: cachedData.compensation,
                team_name: cachedData.team_name,
                description: cachedData.description,
            };
        }
    }

    // 2. Scrape if not in cache or stale
    console.log('Scraping fresh data from Firecrawl for:', cleanedUrl);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

    const options = {
        method: 'POST',
        headers,
        body: JSON.stringify({
            url: cleanedUrl,
            onlyMainContent: false,
            maxAge: 172800000,
            formats: [
                { type: "markdown" },
                {
                    type: "json",
                    schema: {
                        type: "object",
                        required: ["job_title", "company_name", "description"],
                        properties: {
                            job_title: { type: "string" },
                            company_name: { type: "string" },
                            team_name: { type: "string" },
                            location: { type: "string" },
                            compensation: { type: "string" },
                            description: {
                                type: "string",
                                description: "The full, exhaustive job description. DO NOT summarize. Include the role overview, responsibilities, requirements, qualifications, and benefits sections exactly as they appear."
                            }
                        }
                    },
                    prompt: "Extract the full job posting details. You must include the ENTIRE job description, including responsibilities, requirements, qualifications, and any provided pay/benefits information. DO NOT summarize or truncate any part of the job description."
                }
            ]
        })
    };

    const response = await fetch(FIRECRAWL_API_URL, options);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Firecrawl v2: prefer JSON extraction (LLM), fallback to markdown/metadata when absent
    let extractedData = result.data?.json as ScrapedJobData | undefined;

    if (!extractedData && result.data?.markdown) {
        console.log('[Scraper] No JSON from Firecrawl, falling back to markdown/metadata parsing');
        extractedData = parseJobFromMarkdown(result.data);
    }

    if (!extractedData || !extractedData.job_title || !extractedData.company_name || !extractedData.description) {
        throw new Error('Failed to extract structured data from Firecrawl response.');
    }

    // 3. Upsert cache
    const { error: upsertError } = await supabase
        .from('scraped_jobs')
        .upsert({
            url: cleanedUrl,
            job_title: extractedData.job_title,
            company_name: extractedData.company_name,
            location: extractedData.location,
            compensation: extractedData.compensation,
            team_name: extractedData.team_name,
            description: extractedData.description,
            raw_data: result,
            last_scraped_at: new Date().toISOString()
        }, { onConflict: 'url' });

    if (upsertError) {
        console.warn('Failed to update scraper cache:', upsertError);
    }

    return extractedData;
}

/**
 * Enqueues a job for background scraping.
 */
export async function enqueueScrapingJob(url: string, userId: string): Promise<string> {
    const cleanedUrl = cleanJobUrl(url);

    const { data, error } = await supabase
        .from('scraping_jobs')
        .insert({
            url: cleanedUrl,
            user_id: userId,
            status: 'pending'
        })
        .select('id')
        .single();

    if (error) throw error;
    return data.id;
}

/**
 * Processes a specific scraping job.
 */
export async function processScrapingJob(jobId: string): Promise<boolean> {
    // 1. Update status to processing (atomically check if still pending)
    const { data: updatedJob, error: updateError } = await supabase
        .from('scraping_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('status', 'pending')
        .select();

    if (updateError || !updatedJob || updatedJob.length === 0) {
        console.log('[Scraper] Job already being processed or not found:', jobId);
        return false;
    }

    console.log('[Scraper] Starting processing for job:', jobId);

    try {
        // 2. Get the URL
        const { data: job, error: jobError } = await supabase
            .from('scraping_jobs')
            .select('url, user_id')
            .eq('id', jobId)
            .single();

        if (jobError || !job) throw new Error('Job not found');
        console.log('[Scraper] Found job URL:', job.url);

        // 3. Run the extractor
        const scrapedData = await extractJobFromUrl(job.url);
        console.log('[Scraper] Successfully scraped data:', scrapedData.job_title, 'from', scrapedData.company_name);

        // 4. Create the final job record in the 'jobs' table
        console.log('[Scraper] Inserting into jobs table for user:', job.user_id);
        const { data: newJob, error: insertError } = await supabase
            .from('jobs')
            .insert({
                user_id: job.user_id,
                job_title: scrapedData.job_title,
                company: scrapedData.company_name,
                location: scrapedData.location,
                pay_scale: scrapedData.compensation,
                team: scrapedData.team_name,
                job_description: scrapedData.description,
                job_url: job.url,
                status: 'saved', // Changed from 'backlog' to 'saved' to fix constraint error
                priority: 'medium',
                date_added: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('[Scraper] Final insert error:', insertError);
            throw insertError;
        }

        console.log('[Scraper] Job successfully added to board:', newJob.id);

        // 5. Update job status to completed
        const { error: completeError } = await supabase
            .from('scraping_jobs')
            .update({
                status: 'completed',
                data: scrapedData,
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        if (completeError) console.error('[Scraper] Error marking job as completed:', completeError);

        return true;
    } catch (error: any) {
        console.error('Error processing scraping job:', error);
        await supabase
            .from('scraping_jobs')
            .update({
                status: 'failed',
                error: error.message || 'Unknown error',
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        return true; // We handled the error by setting it to 'failed'
    }
}

