ALTER TABLE public.documents ADD COLUMN invoice_details jsonb;
COMMENT ON COLUMN public.documents.invoice_details IS 'Reviewed AI invoice extraction, monetary values in integer bani; accounting rules unchanged.';
CREATE TABLE public.invoice_ai_state (
 company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
 status integer NOT NULL,
 reason text NOT NULL,
 blocked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.invoice_ai_state TO service_role;
ALTER TABLE public.invoice_ai_state ENABLE ROW LEVEL SECURITY;