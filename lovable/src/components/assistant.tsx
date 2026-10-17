import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Send, Square, Trash2, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ERR = "\u0000ERR:";
type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const suggestionsFor = (path: string) => [
  ...(path.startsWith("/documente/expense") ? ["Care sunt facturile furnizorilor neachitate?"] : path.startsWith("/documente/sale") ? ["Ce facturi de vânzare sunt neîncasate?"] : path.startsWith("/contabilitate") ? ["Explică-mi înregistrarea Dt 221 · Ct 611."] : []),
  "Arată-mi facturile neachitate din luna curentă.",
  "Care sunt cheltuielile din luna curentă?",
  "Arată-mi ultimele înregistrări contabile.",
  "Cum înregistrez o încasare de la client?",
].slice(0, 4);

export function AssistantButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button data-t="assistant-open" onClick={() => setOpen(o => !o)} aria-expanded={open} className="fixed bottom-5 right-5 z-[90] rounded-full shadow-none"><MessageSquareText />Asistent Socot</Button>
    {open && <AssistantPanel userId={userId} onClose={() => setOpen(false)} />}
  </>;
}

function AssistantPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { company } = useMembership();
  const path = useRouterState({ select: s => s.location.pathname });
  const qc = useQueryClient();
  const key = ["assistant", company.id, userId];
  const { data: saved, isLoading } = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await supabase.from("assistant_messages").select("role, content").eq("company_id", company.id).eq("user_id", userId).order("created_at").limit(200);
    if (error) throw error; return data as Msg[];
  } });
  const [live, setLive] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  const messages = [...(saved ?? []), ...live];
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length, live]);
  useEffect(() => { if (!busy) box.current?.focus(); }, [busy]);
  useEffect(() => () => abort.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim(); if (!message || busy) return;
    setInput(""); setBusy(true);
    setLive(l => [...l, { role: "user", content: message }, { role: "assistant", content: "" }]);
    const ctrl = new AbortController(); abort.current = ctrl;
    const update = (fn: (m: Msg) => Msg) => setLive(l => [...l.slice(0, -1), fn(l[l.length - 1] as Msg)]);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/assistant", { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ companyId: company.id, message, page: path }) });
      if (!res.ok || !res.body) { const b = await res.json().catch(() => null); throw new Error(b?.error ?? "Asistentul nu este disponibil."); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = "";
      for (;;) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true });
        const i = acc.indexOf(ERR); const shown = i >= 0 ? acc.slice(0, i) : acc; const err = i >= 0 ? acc.slice(i + ERR.length) : "";
        update(m => ({ ...m, content: err ? (shown ? shown + "\n\n" : "") + err : shown, error: !!err })); }
    } catch (e) {
      if (!ctrl.signal.aborted) update(m => ({ ...m, content: e instanceof Error ? e.message : "Asistentul nu este disponibil.", error: true }));
      else update(m => ({ ...m, content: m.content || "Oprit." }));
    } finally {
      setBusy(false); abort.current = null;
      await qc.invalidateQueries({ queryKey: key }); setLive(l => l.filter(m => m.error));
    }
  }
  async function clear() {
    await supabase.from("assistant_messages").delete().eq("company_id", company.id).eq("user_id", userId);
    setLive([]); await qc.invalidateQueries({ queryKey: key });
  }

  return <section role="dialog" aria-label="Asistent Socot" className="fixed bottom-20 right-5 z-[95] flex h-[min(620px,calc(100dvh-10rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col rounded-2xl border bg-card">
    <header className="flex items-center gap-2 rounded-t-2xl bg-sidebar px-4 py-3 text-sidebar-accent-foreground">
      <MessageSquareText className="size-4" /><div className="flex-1"><p className="font-display text-base font-semibold">Asistent Socot</p><p className="text-xs opacity-75">Folosește doar datele reale ale firmei {company.name}</p></div>
      <Button size="icon" variant="ghost" className="text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={clear} disabled={busy} aria-label="Conversație nouă" title="Conversație nouă"><Trash2 className="size-4" /></Button>
      <Button size="icon" variant="ghost" className="text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={onClose} aria-label="Închide asistentul"><X className="size-4" /></Button>
    </header>
    <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
      {isLoading ? <p className="text-muted-foreground">Se încarcă istoricul…</p> : messages.length === 0 && <div className="space-y-3"><p className="text-muted-foreground">Întreabă despre facturi, solduri, înregistrări contabile sau cum folosești Socot. Sugestiile sunt de verificat de contabil.</p>
        <div className="grid gap-2" data-t="assistant-suggestions">{suggestionsFor(path).map(s => <Button key={s} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => send(s)}>{s}</Button>)}</div></div>}
      {messages.map((m, i) => m.role === "user"
        ? <p key={i} className="ml-8 whitespace-pre-wrap rounded-xl bg-primary px-3 py-2 text-primary-foreground">{m.content}</p>
        : <div key={i} className={`prose prose-sm max-w-none ${m.error ? "text-destructive" : ""} [&_a]:text-primary [&_a]:underline [&_table]:text-xs [&_p]:my-1.5`}>
            {m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => href?.startsWith("/") ? <Link to={href as never}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{m.content}</ReactMarkdown> : <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Caut în datele firmei…</span>}
          </div>)}
      <div ref={end} />
    </div>
    <form className="flex items-end gap-2 border-t p-3" onSubmit={e => { e.preventDefault(); void send(input); }}>
      <label className="sr-only" htmlFor="assistant-input">Întrebarea ta</label>
      <Textarea id="assistant-input" data-t="assistant-input" ref={box} rows={2} value={input} maxLength={4000} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} placeholder="De exemplu: cât avem de încasat de la clientul X?" className="min-h-0 resize-none" />
      {busy ? <Button type="button" size="icon" variant="outline" onClick={() => abort.current?.abort()} aria-label="Oprește"><Square className="size-4" /></Button>
        : <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Trimite"><Send className="size-4" /></Button>}
    </form>
  </section>;
}
