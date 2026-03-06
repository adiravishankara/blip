import { supabase } from '../lib/supabase';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/scrape';
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
        .single();

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
    const options = {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: cleanedUrl,
            onlyMainContent: false,
            maxAge: 172800000,
            formats: [
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
                            description: { type: "string" }
                        }
                    },
                    prompt: "Extract information about a given role for the company."
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

    // Firecrawl v2 return format: { success: true, data: { json: { ... } } }
    const extractedData = result.data?.json as ScrapedJobData;

    if (!extractedData) {
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
