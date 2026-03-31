import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// Load pdfjs from a remote URL instead of bundling the full npm package.
// This keeps the edge function bundle small enough for Supabase limits.
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs';
import { createAuthedClient } from '../_shared/supabaseClient.ts';

const session = new Supabase.ai.Session('gte-small');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function normalizeText(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

async function extractPdfText(bytes: Uint8Array, maxChars = 120_000) {
  const pdf = await pdfjsLib.getDocument({
    data: bytes,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  let output = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
      .join(' ');

    output += `${pageText}\n`;
    if (output.length >= maxChars) break;
  }

  return normalizeText(output);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabase = createAuthedClient(req);
  let resumeVersionId: string | null = null;

  try {
    const { resume_version_id } = await req.json();
    resumeVersionId = typeof resume_version_id === 'string' ? resume_version_id : null;

    if (!resumeVersionId) {
      return new Response(JSON.stringify({ error: 'Missing resume_version_id' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const userId = auth.user.id;

    const { data: resumeVersion, error: resumeErr } = await supabase
      .from('resume_versions')
      .select('id,user_id,label,storage_path')
      .eq('id', resumeVersionId)
      .single();

    if (resumeErr || !resumeVersion) {
      return new Response(JSON.stringify({ error: 'Resume version not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    if (resumeVersion.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    await supabase
      .from('resume_versions')
      .update({ embedding_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', resumeVersion.id);

    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('resumes')
      .download(resumeVersion.storage_path);

    if (downloadErr || !fileData) {
      throw new Error(downloadErr?.message ?? 'Failed to download resume PDF.');
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const extractedText = await extractPdfText(bytes);
    if (!extractedText) {
      throw new Error('Could not extract readable text from PDF.');
    }

    const embedding = await session.run(extractedText.slice(0, 20_000), {
      mean_pool: true,
      normalize: true,
    });

    const updatedAt = new Date().toISOString();

    const { error: embeddingErr } = await supabase
      .from('resume_version_embeddings')
      .upsert({
        resume_version_id: resumeVersion.id,
        model: 'gte-small',
        embedding,
        updated_at: updatedAt,
      });

    if (embeddingErr) throw embeddingErr;

    const { error: updateErr } = await supabase
      .from('resume_versions')
      .update({
        extracted_text: extractedText,
        embedding_status: 'ready',
        embedding_model: 'gte-small',
        updated_at: updatedAt,
      })
      .eq('id', resumeVersion.id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ ok: true, status: 'ready' }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    try {
      if (resumeVersionId) {
        await supabase
          .from('resume_versions')
          .update({
            embedding_status: 'error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', resumeVersionId);
      }
    } catch {
      // ignore secondary failure
    }

    return new Response(JSON.stringify({ error: message, status: 'error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});
