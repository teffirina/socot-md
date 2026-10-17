CREATE OR REPLACE FUNCTION public.invoice_storage_access(_name text, _perm text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF split_part(_name,'/',1) !~ '^[0-9a-fA-F-]{36}$' THEN RETURN false; END IF;
 RETURN public.has_perm(split_part(_name,'/',1)::uuid,_perm);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.invoice_storage_access(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_storage_access(text,text) TO authenticated;
CREATE POLICY "invoice attachment read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='invoice-attachments' AND public.invoice_storage_access(name,'read'));
CREATE POLICY "invoice attachment upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='invoice-attachments' AND public.invoice_storage_access(name,'write'));
CREATE POLICY "invoice attachment delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='invoice-attachments' AND public.invoice_storage_access(name,'write') AND NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.invoice_details->'attachment'->>'path'=name));
CREATE OR REPLACE FUNCTION public.validate_complete_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE j jsonb; l jsonb; q numeric; p numeric; r numeric; n bigint; v bigint; sn bigint:=0; sv bigint:=0; rate numeric; key text;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='confirmed' THEN
  IF NEW.invoice_details IS DISTINCT FROM OLD.invoice_details OR NEW.total<>OLD.total OR NEW.number<>OLD.number OR NEW.date<>OLD.date OR NEW.partner_name<>OLD.partner_name OR NEW.company_id<>OLD.company_id OR NEW.kind<>OLD.kind THEN RAISE EXCEPTION 'Factura confirmată nu poate fi modificată.'; END IF;
  RETURN NEW;
 END IF;
 IF length(trim(NEW.number))=0 OR length(NEW.number)>100 OR length(trim(NEW.partner_name))<2 THEN RAISE EXCEPTION 'Completează numărul și partenerul.'; END IF;
 IF NEW.partner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.catalog_entries WHERE id=NEW.partner_id AND company_id=NEW.company_id AND kind='partner') THEN RAISE EXCEPTION 'Partenerul nu aparține întreprinderii.'; END IF;
 j:=NEW.invoice_details;
 key:=lower(regexp_replace(NEW.number,'\s','','g'))||':'||coalesce(nullif(j->(CASE WHEN NEW.kind='sale' THEN 'customer' ELSE 'supplier' END)->>'fiscalCode',''),lower(trim(NEW.partner_name)));
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text||NEW.kind||key,0));
 IF EXISTS(SELECT 1 FROM public.documents d WHERE d.company_id=NEW.company_id AND d.kind=NEW.kind AND d.id<>NEW.id AND lower(regexp_replace(d.number,'\s','','g'))=lower(regexp_replace(NEW.number,'\s','','g')) AND (lower(trim(d.partner_name))=lower(trim(NEW.partner_name)) OR (nullif(j->(CASE WHEN NEW.kind='sale' THEN 'customer' ELSE 'supplier' END)->>'fiscalCode','') IS NOT NULL AND d.invoice_details->(CASE WHEN NEW.kind='sale' THEN 'customer' ELSE 'supplier' END)->>'fiscalCode'=j->(CASE WHEN NEW.kind='sale' THEN 'customer' ELSE 'supplier' END)->>'fiscalCode'))) THEN RAISE EXCEPTION 'Factura există deja pentru acest partener.'; END IF;
 IF j IS NULL OR j->>'version' IS DISTINCT FROM '2' THEN RETURN NEW; END IF;
 IF octet_length(j::text)>250000 OR j->>'currency' NOT IN ('MDL','EUR','USD') THEN RAISE EXCEPTION 'Datele facturii sunt invalide.'; END IF;
 IF j->>'issueDate' IS DISTINCT FROM NEW.date::text OR trim(concat_ws(' ',nullif(j->>'series',''),j->>'number'))<>NEW.number THEN RAISE EXCEPTION 'Numărul sau data nu corespund facturii.'; END IF;
 IF j->>'mode'='complete' THEN
  IF length(trim(coalesce(j->'supplier'->>'name','')))<2 OR length(trim(coalesce(j->'customer'->>'name','')))<2 THEN RAISE EXCEPTION 'Completează furnizorul și cumpărătorul.'; END IF;
 END IF;
 IF jsonb_array_length(j->'lines')>200 THEN RAISE EXCEPTION 'Maximum 200 poziții.'; END IF;
 FOR l IN SELECT value FROM jsonb_array_elements(j->'lines') LOOP
  q:=replace(l->>'quantity',',','.')::numeric; p:=(l->>'unitPrice')::numeric;
  r:=replace(replace(coalesce(l->>'vatRate','0'),'%',''),',','.')::numeric;
  IF q IS NULL OR q<=0 OR p IS NULL OR p<0 OR p<>trunc(p) OR r<0 OR r>100 OR length(trim(coalesce(l->>'name','')))=0 OR length(trim(coalesce(l->>'unit','')))=0 THEN RAISE EXCEPTION 'Verifică denumirea, unitatea, cantitatea, prețul și TVA.'; END IF;
  n:=round(q*p); v:=round(n*r/100);
  IF (l->>'net')::numeric IS DISTINCT FROM n OR (l->>'vat')::numeric IS DISTINCT FROM v THEN RAISE EXCEPTION 'Valorile poziției nu corespund calculelor.'; END IF;
  sn:=sn+n; sv:=sv+v;
 END LOOP;
 IF jsonb_array_length(j->'lines')>0 AND ((j->>'net')::numeric IS DISTINCT FROM sn OR (j->>'vat')::numeric IS DISTINCT FROM sv OR (j->>'total')::numeric IS DISTINCT FROM sn+sv) THEN RAISE EXCEPTION 'Totalurile nu corespund pozițiilor.'; END IF;
 IF (j->>'total')::numeric IS DISTINCT FROM ((j->>'net')::numeric+(j->>'vat')::numeric) OR (j->>'total')::numeric<=0 OR (j->>'total')::numeric<>trunc((j->>'total')::numeric) THEN RAISE EXCEPTION 'Total invalid.'; END IF;
 rate:=CASE WHEN j->>'currency'='MDL' THEN 1 ELSE replace(j->>'exchangeRate',',','.')::numeric END;
 IF rate IS NULL OR rate<=0 OR rate>100000 OR NEW.total IS DISTINCT FROM round((j->>'total')::numeric*rate)::bigint THEN RAISE EXCEPTION 'Completează cursul și verifică echivalentul MDL.'; END IF;
 IF j->'attachment' IS NOT NULL AND j->'attachment'<>'null'::jsonb AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='invoice-attachments' AND name=j->'attachment'->>'path' AND split_part(name,'/',1)=NEW.company_id::text) THEN RAISE EXCEPTION 'Atașamentul nu aparține întreprinderii.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_complete_invoice BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.validate_complete_invoice();
CREATE OR REPLACE FUNCTION public.confirm_document(_doc uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.documents;
BEGIN
 SELECT * INTO d FROM public.documents WHERE id=_doc FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Documentul nu există.'; END IF;
 IF NOT public.has_perm(d.company_id,'journal.post') THEN RAISE EXCEPTION 'Confirmarea facturii necesită drept de contabil.'; END IF;
 IF d.status<>'draft' THEN RAISE EXCEPTION 'Documentul este deja confirmat.'; END IF;
 UPDATE public.documents SET status='confirmed' WHERE id=_doc;
 INSERT INTO public.journal_entries(company_id,document_id,operation,debit,credit,amount,date) VALUES(d.company_id,d.id,CASE WHEN d.kind='sale' THEN 'sale' ELSE 'expense' END,CASE WHEN d.kind='sale' THEN '221' ELSE '713' END,CASE WHEN d.kind='sale' THEN '611' ELSE '521' END,d.total,d.date);
END $$;
REVOKE EXECUTE ON FUNCTION public.confirm_document(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_document(uuid) TO authenticated;