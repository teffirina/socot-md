CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_messages_owner ON public.assistant_messages(user_id, company_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assistant read" ON public.assistant_messages FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.company_role(company_id) IS NOT NULL);
CREATE POLICY "own assistant insert" ON public.assistant_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.company_role(company_id) IS NOT NULL);
CREATE POLICY "own assistant delete" ON public.assistant_messages FOR DELETE TO authenticated USING (user_id = auth.uid());