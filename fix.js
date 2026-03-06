import { createClient } from '@supabase/supabase-js';

const supabase = createClient('http://127.0.0.1:54321', 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH');

async function fixStuck() {
    const { data, error } = await supabase
        .from('scraping_jobs')
        .update({ status: 'failed', error: 'Stuck process cleared' })
        .eq('status', 'processing');

    console.log('Fixed stuck processing jobs:', data, error);
}

fixStuck();
