import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id";

export const ASSISTANT_ERROR = "\u0000ERR:";
const lei = (b: number) => (b / 100).toFixed(2) + " MDL";

const SYSTEM = (ctx: { company: string; page: string; today: string; journal: boolean }) => `Ești „Asistent Socot”, asistentul contabil al aplicației Socot (Republica Moldova, MDL). Răspunzi în română, simplu, calm, fără semne de exclamare, adresându-te cu „tu”.
Întreprinderea: ${ctx.company}. Azi: ${ctx.today}. Pagina curentă a utilizatorului: ${ctx.page}.
Reguli stricte:
- Pentru orice întrebare despre facturi, sume, solduri, parteneri sau înregistrări folosește instrumentele. Nu inventa niciodată documente, sume sau solduri. Dacă instrumentele nu returnează date, spune clar că nu există suficiente informații.
- La final, menționează sursa („Sursa: documentele Socot” / „jurnalul contabil”) și perioada analizată.
- Pentru fiecare document listat pune un link markdown spre câmpul "link" primit, de exemplu [V-0001](/documente/sale?record=...).
- ${ctx.journal ? "Poți consulta jurnalul contabil." : "Utilizatorul nu are acces la jurnalul contabil; nu îl consulta."}
- Formulele contabile pe care le propui sunt sugestii, nu înregistrări validate; spune că necesită verificarea contabilului. Modelele Socot: vânzare Dt 221 · Ct 611, încasare Dt 242 · Ct 221, cumpărare Dt 713 · Ct 521, plată Dt 521 · Ct 242 (model demonstrativ fără TVA).
- Nu poți modifica, șterge sau înregistra documente. Fluxul rămâne Salvează → Verifică → Înregistrează, cu confirmarea contabilului. Poți doar propune completări pe care utilizatorul le verifică.
- Pentru întrebări legislative, spune că informația trebuie verificată în sursele oficiale (legis.md, SFS) și nu da cifre fără sursă și dată de valabilitate.
- Funcții Socot: Vânzări/Cumpărări (Document nou, scanare AI, Tipărește factura fiscală), Bancă și casă, Contabilitate, Rapoarte, Nomenclatoare, Întreprindere, butonul + Nou, căutarea universală, Tutorial.
- Folosește termenii: înregistrare contabilă, contabilizează, încasare, sold, balanța de verificare, fișa contului.`;

export async function runAssistant(request: Request, cfg: { url: string; key: string; aiKey: string }) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return Response.json({ error: "Autentifică-te pentru a folosi asistentul." }, { status: 401 });
  const db = createClient<Database>(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (i, init) => { const h = new Headers(init?.headers); h.set("apikey", cfg.key); return fetch(i, { ...init, headers: h }); } },
  });
  const { data: u } = await db.auth.getUser(token);
  if (!u.user) return Response.json({ error: "Sesiunea a expirat." }, { status: 401 });
  const body = await request.json().catch(() => null) as { companyId?: string; message?: string; page?: string } | null;
  const companyId = body?.companyId ?? "";
  const message = (body?.message ?? "").trim().slice(0, 4000);
  if (!/^[0-9a-f-]{36}$/i.test(companyId) || !message) return Response.json({ error: "Cerere invalidă." }, { status: 400 });
  const [{ data: canRead }, { data: canJournal }, { data: company }] = await Promise.all([
    db.rpc("has_perm", { _company: companyId, _perm: "read" }),
    db.rpc("has_perm", { _company: companyId, _perm: "journal.read" }),
    db.from("companies").select("name").eq("id", companyId).maybeSingle(),
  ]);
  if (!company) return Response.json({ error: "Nu ai acces la această întreprindere." }, { status: 403 });

  const { data: history } = await db.from("assistant_messages").select("role, content").eq("company_id", companyId).eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(30);
  const { error: insErr } = await db.from("assistant_messages").insert({ company_id: companyId, role: "user", content: message });
  if (insErr) return Response.json({ error: "Mesajul nu a putut fi salvat." }, { status: 500 });
  const messages: ModelMessage[] = [...(history ?? []).reverse().map(m => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user", content: message }];

  const denied = { error: "Rolul tău nu are acces la aceste date." };
  const tools = {
    search_documents: tool({
      description: "Caută facturi de vânzare (sale) sau cumpărare (expense) ale întreprinderii.",
      inputSchema: z.object({
        kind: z.enum(["sale", "expense", "any"]), partner: z.string().nullable(), status: z.enum(["draft", "confirmed", "any"]),
        unpaidOnly: z.boolean(), from: z.string().nullable().describe("YYYY-MM-DD"), to: z.string().nullable().describe("YYYY-MM-DD"), limit: z.number().int().min(1).max(50),
      }),
      execute: async (a) => {
        if (!canRead) return denied;
        let q = db.from("documents").select("id, kind, number, date, partner_name, total, paid, status, description").eq("company_id", companyId).order("date", { ascending: false }).limit(a.unpaidOnly ? 200 : a.limit);
        if (a.kind !== "any") q = q.eq("kind", a.kind);
        if (a.status !== "any") q = q.eq("status", a.status);
        if (a.partner) q = q.ilike("partner_name", `%${a.partner.replace(/[%_,()]/g, "")}%`);
        if (a.from) q = q.gte("date", a.from);
        if (a.to) q = q.lte("date", a.to);
        const { data, error } = await q;
        if (error) return { error: "Căutarea nu a reușit." };
        const rows = (data ?? []).filter(d => !a.unpaidOnly || (d.status === "confirmed" && d.paid < d.total)).slice(0, a.limit);
        return { count: rows.length, documents: rows.map(d => ({ number: d.number, kind: d.kind === "sale" ? "vânzare" : "cumpărare", date: d.date, partner: d.partner_name, total: lei(d.total), paid: lei(d.paid), rest: lei(d.total - d.paid), status: d.status === "draft" ? "ciornă" : "confirmat", description: d.description, link: `/documente/${d.kind}?record=${d.id}` })),
          totals: { total: lei(rows.reduce((s, d) => s + d.total, 0)), rest: lei(rows.reduce((s, d) => s + d.total - d.paid, 0)) } };
      },
    }),
    partner_balance: tool({
      description: "Calculează cât avem de încasat de la un client sau de plătit unui furnizor (facturi confirmate).",
      inputSchema: z.object({ partner: z.string() }),
      execute: async ({ partner }) => {
        if (!canRead) return denied;
        const { data, error } = await db.from("documents").select("kind, total, paid, partner_name").eq("company_id", companyId).eq("status", "confirmed").ilike("partner_name", `%${partner.replace(/[%_,()]/g, "")}%`);
        if (error) return { error: "Calculul nu a reușit." };
        const sum = (k: string) => (data ?? []).filter(d => d.kind === k).reduce((s, d) => s + d.total - d.paid, 0);
        return { partners: [...new Set((data ?? []).map(d => d.partner_name))], deIncasat: lei(sum("sale")), dePlatit: lei(sum("expense")), documente: data?.length ?? 0 };
      },
    }),
    journal_entries: tool({
      description: "Ultimele înregistrări contabile (Dt/Ct) din jurnal.",
      inputSchema: z.object({ from: z.string().nullable(), to: z.string().nullable(), limit: z.number().int().min(1).max(50) }),
      execute: async (a) => {
        if (!canJournal) return denied;
        let q = db.from("journal_entries").select("date, debit, credit, amount, state, operation, documents(number, partner_name)").eq("company_id", companyId).order("date", { ascending: false }).limit(a.limit);
        if (a.from) q = q.gte("date", a.from);
        if (a.to) q = q.lte("date", a.to);
        const { data, error } = await q;
        if (error) return { error: "Jurnalul nu a putut fi citit." };
        return { entries: (data ?? []).map(e => ({ date: e.date, conturi: `Dt ${e.debit} · Ct ${e.credit}`, suma: lei(e.amount), stare: e.state === "posted" ? "înregistrat" : "propus", document: e.documents ? `${e.documents.number} · ${e.documents.partner_name}` : null })) };
      },
    }),
  };

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  let upstreamError = "";
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: cfg.aiKey,
    headers: { "Lovable-API-Key": cfg.aiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (i, init) => {
      const r = await runIdFetch.fetch(i, init);
      if (!r.ok) { const b = await r.clone().json().catch(() => null); upstreamError = r.status === 402 ? (b?.message ?? "Creditele AI s-au epuizat.") : r.status === 429 ? "Prea multe cereri. Încearcă peste un minut." : (b?.message ?? "Serviciul AI nu este disponibil acum."); }
      return r;
    },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: SYSTEM({ company: company.name, page: (body?.page ?? "/").slice(0, 100), today: new Date().toISOString().slice(0, 10), journal: !!canJournal }),
    messages, tools, stopWhen: stepCountIs(6), maxRetries: 0, abortSignal: request.signal,
    providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
  });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      let text = "";
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") { text += part.text; ctrl.enqueue(enc.encode(part.text)); }
          else if (part.type === "error") throw part.error;
        }
        if (text.trim()) await db.from("assistant_messages").insert({ company_id: companyId, role: "assistant", content: text.slice(0, 20000) });
        else ctrl.enqueue(enc.encode(ASSISTANT_ERROR + (upstreamError || "Asistentul nu a putut formula un răspuns.")));
      } catch {
        if (!request.signal.aborted) ctrl.enqueue(enc.encode(ASSISTANT_ERROR + (upstreamError || "Asistentul nu este disponibil acum.")));
      } finally { ctrl.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
