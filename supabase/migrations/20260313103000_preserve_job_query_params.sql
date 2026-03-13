/*
  # Preserve Job-Defining Query Params In URL Normalization

  Updates URL normalization so it removes tracking params but preserves
  role-defining params like gh_jid, jobId, requisition IDs, etc.
  Safe to run from Supabase SQL Editor.
*/

CREATE OR REPLACE FUNCTION public.normalize_job_url(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  raw_url text := nullif(trim(input), '');
  base_part text;
  query_part text;
  host_path text;
  host_part text;
  path_part text;
  final_query text := '';
  pair text;
  key_part text;
  value_part text;
BEGIN
  IF raw_url IS NULL THEN
    RETURN NULL;
  END IF;

  raw_url := split_part(raw_url, '#', 1);
  raw_url := regexp_replace(raw_url, '^https?://', '', 'i');
  raw_url := regexp_replace(raw_url, '^www\.', '', 'i');

  base_part := split_part(raw_url, '?', 1);
  query_part := NULLIF(split_part(raw_url, '?', 2), '');

  host_part := split_part(base_part, '/', 1);
  path_part := substr(base_part, length(host_part) + 1);

  host_part := lower(host_part);
  path_part := regexp_replace(path_part, '/+', '/', 'g');
  path_part := regexp_replace(path_part, '/+$', '');
  host_path := host_part || path_part;

  IF query_part IS NOT NULL THEN
    FOR pair IN
      SELECT value
      FROM unnest(string_to_array(query_part, '&')) AS value
      WHERE value <> ''
      ORDER BY split_part(value, '=', 1), split_part(value, '=', 2)
    LOOP
      key_part := split_part(pair, '=', 1);
      value_part := split_part(pair, '=', 2);

      IF key_part ~* '^(utm_|fbclid$|gclid$|msclkid$|mc_|mkt_|ref$|referrer$|referral$|source$|src$|gh_src$|icid$|yclid$|igshid$|pk_|_hs)'
      THEN
        CONTINUE;
      END IF;

      final_query := CASE
        WHEN final_query = '' THEN key_part || CASE WHEN value_part <> '' THEN '=' || value_part ELSE '' END
        ELSE final_query || '&' || key_part || CASE WHEN value_part <> '' THEN '=' || value_part ELSE '' END
      END;
    END LOOP;
  END IF;

  IF final_query <> '' THEN
    RETURN host_path || '?' || final_query;
  END IF;

  RETURN host_path;
END;
$$;

UPDATE public.jobs
SET normalized_job_url = public.normalize_job_url(job_url)
WHERE normalized_job_url IS DISTINCT FROM public.normalize_job_url(job_url);
