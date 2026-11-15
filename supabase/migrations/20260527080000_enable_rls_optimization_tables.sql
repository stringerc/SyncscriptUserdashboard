-- Enable RLS on optimization_runs and optimization_results
-- These tables contain user-scoped data but were missing row-level security

-- optimization_runs: only owners can access their own runs
ALTER TABLE public.optimization_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own optimization runs"
  ON public.optimization_runs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Owners can insert their own optimization runs"
  ON public.optimization_runs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Owners can update their own optimization runs"
  ON public.optimization_runs FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Owners can delete their own optimization runs"
  ON public.optimization_runs FOR DELETE
  USING (auth.uid()::text = user_id);

-- optimization_results: only owners can access their own results
ALTER TABLE public.optimization_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own optimization results"
  ON public.optimization_results FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Owners can insert their own optimization results"
  ON public.optimization_results FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Owners can update their own optimization results"
  ON public.optimization_results FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Owners can delete their own optimization results"
  ON public.optimization_results FOR DELETE
  USING (auth.uid()::text = user_id);

-- Service role bypasses RLS (already granted by Supabase defaults)
