import { supabase } from '../lib/supabase';
import { hasExactDuplicate } from './duplicates';
import { getActiveFirecrawlUrl } from '../utils/storage';

export type ScrapingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ScrapingJob {
  id: string;
  user_id: string;
  url: string;
  status: ScrapingStatus;
  error?: string;
  data?: unknown;
  created_at: string;
}

const API_KEY = import.meta.env.VITE_FIRECRAWL_API_KEY;

export interface ScrapedJobData {
  job_title: string;
  company_name: string;
  location?: string;
  compensation?: string;
  team_name?: string;
  description: string;
}

export function cleanJobUrl(url: string): string {
  try {
    return url.split('?')[0];
  } catch {
    return url;
  }
}

export async function extractJobFromUrl(url: string): Promise<ScrapedJobData> {
  const cleanedUrl = cleanJobUrl(url);

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

  const response = await fetch(getActiveFirecrawlUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: cleanedUrl,
      onlyMainContent: false,
      maxAge: 172800000,
      formats: [
        {
          type: 'json',
          schema: {
            type: 'object',
            required: ['job_title', 'company_name', 'description'],
            properties: {
              job_title: { type: 'string' },
              company_name: { type: 'string' },
              team_name: { type: 'string' },
              location: { type: 'string' },
              compensation: { type: 'string' },
              description: {
                type: 'string',
                description: 'The full, exhaustive job description. Do not summarize.',
              },
            },
          },
          prompt: 'Extract the full job posting details without summarizing the description.',
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const extractedData = result.data?.json as ScrapedJobData | undefined;

  if (!extractedData) {
    throw new Error('Failed to extract structured data from Firecrawl response.');
  }

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
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: 'url' });

  if (upsertError) {
    console.warn('Failed to update scraper cache:', upsertError);
  }

  return extractedData;
}

export async function enqueueScrapingJob(url: string, userId: string): Promise<string> {
  const cleanedUrl = cleanJobUrl(url);

  const { data, error } = await supabase
    .from('scraping_jobs')
    .insert({
      url: cleanedUrl,
      user_id: userId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function processScrapingJob(jobId: string): Promise<boolean> {
  const { data: updatedJob, error: updateError } = await supabase
    .from('scraping_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select();

  if (updateError || !updatedJob || updatedJob.length === 0) {
    return false;
  }

  try {
    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .select('url, user_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) throw new Error('Job not found');

    const scrapedData = await extractJobFromUrl(job.url);
    const duplicateExists = await hasExactDuplicate({
      userId: job.user_id,
      company: scrapedData.company_name,
      jobTitle: scrapedData.job_title,
      jobUrl: job.url,
    });

    if (duplicateExists) {
      const { error: duplicateUpdateError } = await supabase
        .from('scraping_jobs')
        .update({
          status: 'completed',
          data: {
            duplicate: true,
            duplicate_reason: 'matching_url_or_company_title',
            scraped: scrapedData,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (duplicateUpdateError) {
        console.error('[Scraper] Error marking duplicate scrape as completed:', duplicateUpdateError);
      }

      return true;
    }

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
        status: 'saved',
        priority: 'medium',
        date_added: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { error: completeError } = await supabase
      .from('scraping_jobs')
      .update({
        status: 'completed',
        data: { duplicate: false, scraped: scrapedData, job_id: newJob.id },
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (completeError) console.error('[Scraper] Error marking job as completed:', completeError);

    return true;
  } catch (error) {
    await supabase
      .from('scraping_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return true;
  }
}
