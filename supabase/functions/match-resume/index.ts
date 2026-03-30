import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createAuthedClient } from '../_shared/supabaseClient.ts';

const session = new Supabase.ai.Session('gte-small');

function normalizeText(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

function extractKeywords(text: string) {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = cleaned.split(' ');
  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const p of parts) {
    if (p.length < 4) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    keywords.push(p);
    if (keywords.length >= 80) break;
  }

  return keywords;
}

function keywordOverlapScore(jdKeywords: string[], resumeText: string) {
  const hay = ` ${resumeText.toLowerCase()} `;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of jdKeywords) {
    if (hay.includes(` ${kw} `)) matched.push(kw);
    else missing.push(kw);
  }

  const overlap = jdKeywords.length ? matched.length / jdKeywords.length : 0;
  return { overlap, matched, missing };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabase = createAuthedClient(req);

  try {
    const { job_id } = await req.json();
    if (!job_id || typeof job_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing job_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = auth.user.id;

    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id,user_id,job_description')
      .eq('id', job_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (job.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const jdText = normalizeText(job.job_description ?? '');
    if (!jdText) {
      return new Response(JSON.stringify({ error: 'Job is missing job_description' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure job embedding exists (regenerate every time for v1 simplicity)
    const jdEmbedding = await session.run(jdText, { mean_pool: true, normalize: true });
    const model = 'gte-small';

    await supabase
      .from('job_embeddings')
      .upsert({ job_id: job.id, model, embedding: jdEmbedding, updated_at: new Date().toISOString() });

    // Fetch similar resumes by embedding
    const { data: matches, error: matchErr } = await supabase.rpc('match_resumes', {
      query_embedding: jdEmbedding,
      match_user_id: userId,
      match_count: 5,
    });

    if (matchErr) {
      return new Response(JSON.stringify({ error: matchErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!matches || matches.length === 0) {
      // No resumes uploaded / ready
      await supabase
        .from('jobs')
        .update({ match_score: null, match_score_updated_at: new Date().toISOString() })
        .eq('id', job.id);

      return new Response(JSON.stringify({ results: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resumeIds = matches.map((m: any) => m.resume_version_id);
    const { data: resumeRows } = await supabase
      .from('resume_versions')
      .select('id,label,extracted_text')
      .in('id', resumeIds);

    const resumeById = new Map<string, { id: string; label: string; extracted_text?: string | null }>();
    (resumeRows ?? []).forEach((r: any) => resumeById.set(r.id, r));

    const jdKeywords = extractKeywords(jdText);

    const results = matches.map((m: any) => {
      const r = resumeById.get(m.resume_version_id);
      const resumeText = normalizeText(r?.extracted_text ?? '');
      const { overlap, matched, missing } = keywordOverlapScore(jdKeywords, resumeText);
      const semanticSim = typeof m.similarity === 'number' ? m.similarity : 0;
      const score = (semanticSim * 0.7 + overlap * 0.3) * 100;

      return {
        resume_version_id: m.resume_version_id,
        label: r?.label ?? m.label ?? 'Resume',
        score,
        semantic_sim: semanticSim,
        keyword_overlap: overlap,
        matched_keywords: matched.slice(0, 25),
        missing_keywords: missing.slice(0, 25),
      };
    }).sort((a: any, b: any) => b.score - a.score);

    const bestScore = results[0]?.score ?? null;
    await supabase
      .from('jobs')
      .update({ match_score: bestScore, match_score_updated_at: new Date().toISOString() })
      .eq('id', job.id);

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

