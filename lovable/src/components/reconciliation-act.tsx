import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMembership } from "@/lib/company";
import { documentsQuery, paymentsQuery, catalogQuery } from "@/lib/documents";
import { buildReconciliation } from "@/lib/reconciliation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const lei = (v: number) => (v === 0 ? "" : (v / 100).toLocaleString("ro-MD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " "));
const leiFull = (v: number) => (v / 100).toLocaleString("ro-MD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ");
const dateRo = (v: string) => v.split("-").reverse().join(".");
const detail = (d: unknown, k: string) => {
  if (!d || typeof d !== "object") return "";
  const v = (d as Record<string, unknown>)[k];
  return typeof v === "string" ? v : "";
};

export function ReconciliationActDialog({ onClose }: { onClose: () => void }) {
  const { company } = useMembership();
  const { data: docs } = useSuspenseQuery(documentsQuery(company.id));
  const { data: payments } = useSuspenseQuery(paymentsQuery(company.id));
  const { data: partners } = useSuspenseQuery(catalogQuery(company.id, "partner"));

  const clientNames = useMemo(() => {
    const fromDocs = docs.filter((d) => d.kind === "sale").map((d) => d.partner_name);
    const fromCatalog = partners.map((p) => p.name);
    return [...new Set([...fromCatalog, ...fromDocs].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ro"));
  }, [docs, partners]);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const suggestions = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ro");
    return (q ? clientNames.filter((n) => n.toLocaleLowerCase("ro").includes(q)) : clientNames).slice(0, 8);
  }, [query, clientNames]);

  const [partner, setPartner] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [generated, setGenerated] = useState(false);

  const entry = partners.find((p) => p.name === partner);
  const act = useMemo(
    () => (partner ? buildReconciliation(docs, payments, partner, from || undefined, to || undefined) : null),
    [docs, payments, partner, from, to],
  );

  const ready = partner && from && to;
  const partnerIdno = entry ? detail(entry.details, "idno") : "";
  const partnerAddress = entry ? detail(entry.details, "address") : "";
  const partnerPhone = entry ? detail(entry.details, "phone") : "";
  const partnerIban = entry ? detail(entry.details, "iban") : "";
  const partnerBank = entry ? detail(entry.details, "bank") : "";
  const partnerBankCode = entry ? detail(entry.details, "bankCode") : "";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="invoice-print-dialog top-[3dvh] block max-h-[94dvh] w-[calc(100%-1rem)] max-w-5xl translate-y-0 space-y-4 overflow-y-auto">
        <DialogHeader className="no-print">
          <DialogTitle className="font-display text-2xl">Act de verificare a decontărilor reciproce</DialogTitle>
          <DialogDescription>Alegi clientul și perioada. Aplicația completează partea firmei tale cu vânzările și încasările înregistrate; partea clientului rămâne goală, pentru datele lui.</DialogDescription>
        </DialogHeader>

        <div className="no-print grid gap-3 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4" data-t="act-form">
          <div className="relative grid gap-1.5">
            <Label htmlFor="act-partner">Clientul</Label>
            <input
              id="act-partner"
              role="combobox"
              aria-expanded={listOpen}
              aria-controls="act-partner-list"
              autoComplete="off"
              placeholder="Scrie primele litere ale numelui…"
              className="h-11 rounded-lg border bg-background px-3 text-sm"
              value={query}
              onFocus={() => setListOpen(true)}
              onBlur={() => setTimeout(() => setListOpen(false), 150)}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setListOpen(true);
                setPartner(clientNames.includes(v) ? v : "");
                setGenerated(false);
              }}
            />
            {listOpen && (
              <ul id="act-partner-list" role="listbox" className="absolute top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-sm">
                {suggestions.length === 0 && <li className="px-3 py-2 text-muted-foreground">Niciun client găsit</li>}
                {suggestions.map((n) => (
                  <li key={n} role="option" aria-selected={n === partner}>
                    <button
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setQuery(n); setPartner(n); setListOpen(false); setGenerated(false); }}
                    >{n}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="act-from">Perioada: de la</Label>
            <Input id="act-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setGenerated(false); }} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="act-to">până la</Label>
            <Input id="act-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setGenerated(false); }} />
          </div>
          <div className="flex items-end gap-2">
            <Button disabled={!ready} onClick={() => setGenerated(true)}>Generează actul</Button>
            {generated && <Button variant="outline" onClick={() => window.print()}><Printer />Tipărește</Button>}
          </div>
        </div>

        {generated && act && (
          <div className="overflow-x-auto">
            <div className="invoice-sheet">
              <p className="head" style={{ marginLeft: 0, justifyContent: "center", textAlign: "center" }}>
                <b>Act de verificare al decontărilor reciproce</b><br />
                privind decontările reciproce la data {dateRo(to)} între {company.name}{company.idno ? `, c.f. ${company.idno}` : ""} și {partner}{partnerIdno ? `, c.f. ${partnerIdno}` : ""}
              </p>
              <table className="lines">
                <thead>
                  <tr>
                    <th colSpan={4}>Conform datelor {company.name}{company.idno ? `, c.f. ${company.idno}` : ""}, LEI</th>
                    <th colSpan={4}>Conform datelor {partner}{partnerIdno ? `, c.f. ${partnerIdno}` : ""}, LEI</th>
                  </tr>
                  <tr>
                    <th>Data</th><th>Document</th><th>Debit</th><th>Credit</th>
                    <th>Data</th><th>Document</th><th>Debit</th><th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2}>Sold iniţial la {dateRo(from)}</td><td /><td />
                    <td colSpan={2}>Sold iniţial la {dateRo(from)}</td><td /><td />
                  </tr>
                  {act.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="num">{dateRo(r.date)}</td>
                      <td className="left">{r.document}</td>
                      <td className="num">{lei(r.debit)}</td>
                      <td className="num">{lei(r.credit)}</td>
                      <td /><td /><td /><td />
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="left"><b>Rulaje pe perioadă</b></td>
                    <td className="num"><b>{leiFull(act.rulajDebit)}</b></td>
                    <td className="num"><b>{leiFull(act.rulajCredit)}</b></td>
                    <td className="left"><b>Rulaje pe perioadă</b></td><td /><td /><td />
                  </tr>
                  <tr>
                    <td colSpan={2} className="left"><b>Sold final</b></td>
                    <td className="num"><b>{act.soldFinal < 0 ? leiFull(-act.soldFinal) : ""}</b></td>
                    <td className="num"><b>{act.soldFinal > 0 ? leiFull(act.soldFinal) : ""}</b></td>
                    <td className="left"><b>Sold final</b></td><td /><td /><td />
                  </tr>
                </tbody>
              </table>
              <p style={{ margin: "10px 0" }}>
                Conform datelor {company.name}{company.idno ? `, c.f. ${company.idno}` : ""}{" "}
                <b>la {dateRo(to)} {act.soldFinal === 0 ? "datoriile lipsesc." : act.soldFinal > 0 ? `datoria clientului este de ${leiFull(act.soldFinal)} lei.` : `datoria furnizorului este de ${leiFull(-act.soldFinal)} lei.`}</b>
              </p>
              <table className="frame">
                <tbody>
                  <tr>
                    <td className="b" style={{ width: "50%" }}>
                      <div className="val"><b>{company.name}</b><br />Cod fiscal (IDNO): {company.idno ?? ""}<br />Adresa: {company.address ?? ""}<br />Rechizite bancare:<br />Cont de decontare: {company.iban ?? ""}<br />{company.bank ? `în ${company.bank}` : ""}</div>
                    </td>
                    <td className="b" style={{ width: "50%" }}>
                      <div className="val"><b>{partner}</b><br />Cod fiscal (IDNO): {partnerIdno}<br />Adresa: {partnerAddress}<br />Telefon: {partnerPhone}<br />Rechizite bancare:<br />Cont de decontare: {partnerIban}<br />{partnerBank ? `în ${partnerBank}` : ""}{partnerBankCode ? ` · ${partnerBankCode}` : ""}</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="b"><div className="val" style={{ minHeight: 30 }}>L.Ș.</div></td>
                    <td className="b"><div className="val" style={{ minHeight: 30 }}>L.Ș.</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
