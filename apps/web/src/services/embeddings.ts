import { supabase } from '../lib/supabase';

export type EmbeddingModel = 'gte-small';

export async function embedText(input: string): Promise<{ embedding: number[]; model: EmbeddingModel }> {
  const { data, error } = await supabase.functions.invoke('embed', {
    body: { input },
  });

  if (error) throw error;
  if (!data?.embedding) throw new Error('Embedding function returned no embedding.');

  return { embedding: data.embedding as number[], model: (data.model ?? 'gte-small') as EmbeddingModel };
}

