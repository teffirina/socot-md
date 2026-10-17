import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Invoice } from '@/lib/invoice';
import { Button } from '@/components/ui/button';
import { Paperclip } from 'lucide-react';
export function InvoiceAttachment({ attachment }: { attachment: Invoice['attachment'] }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let active = true; if (!attachment) return; void supabase.storage.from('invoice-attachments').createSignedUrl(attachment.path, 300).then(({ data, error }) => { if (active) { setUrl(data?.signedUrl ?? ''); setError(error ? 'Atașamentul nu poate fi deschis.' : ''); } }); return () => { active = false; }; }, [attachment]);
  if (!attachment) return null;
  return <div className="grid gap-2">{url && <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><Paperclip />{attachment.name}</a></Button>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}