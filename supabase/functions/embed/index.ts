import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const session = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { input } = await req.json();

    if (typeof input !== 'string' || !input.trim()) {
      return new Response(JSON.stringify({ error: 'Missing input' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const embedding = await session.run(input, {
      mean_pool: true,
      normalize: true,
    });

    return new Response(JSON.stringify({ embedding, model: 'gte-small' }), {
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

