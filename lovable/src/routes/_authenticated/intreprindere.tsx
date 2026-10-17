import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/lib/company";
import { can } from "@/lib/permissions";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/intreprindere")({
  head: () => pageMeta("Întreprindere — Socot", "Gestionează datele firmei folosite pe documente."),
  component: CompanyPage,
});

const fields = [
  ["name", "Denumire"],
  ["idno", "IDNO"],
  ["address", "Adresă juridică"],
  ["iban", "IBAN"],
  ["bank", "Banca"],
  ["director", "Director"],
  ["chief_accountant", "Contabil-șef"],
] as const;

function CompanyPage() {
  const { role, company } = useMembership();
  const editable = can(role, "company");
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({ ...company }));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (form.name.trim().length < 2) return void toast.error("Completează denumirea.");
    if (form.idno && !/^\d{13}$/.test(form.idno)) return void toast.error("IDNO trebuie să aibă 13 cifre.");
    setBusy(true);
    const { error } = await supabase
      .from("companies")
      .update({
        name: form.name.trim(),
        idno: form.idno || null,
        address: form.address || null,
        iban: form.iban || null,
        bank: form.bank || null,
        director: form.director || null,
        chief_accountant: form.chief_accountant || null,
        vat_payer: form.vat_payer,
      })
      .eq("id", company.id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Datele întreprinderii au fost salvate.");
    qc.invalidateQueries({ queryKey: ["membership"] });
  }

  return (
    <>
      <PageHeading eyebrow="Organizare" title="Întreprindere" subtitle="Rechizitele care apar pe documente." />
      <form onSubmit={save} className="grid max-w-2xl gap-4 rounded-2xl border bg-card p-6 shadow-soft sm:grid-cols-2" data-t="company-form">
        {fields.map(([k, label]) => (
          <div key={k} className={`grid gap-1.5 ${k === "name" || k === "address" ? "sm:col-span-2" : ""}`}>
            <Label>{label}</Label>
            <Input disabled={!editable} value={(form[k] as string | null) ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <label className="flex items-center gap-3 sm:col-span-2">
          <Switch disabled={!editable} checked={form.vat_payer} onCheckedChange={(v) => setForm({ ...form, vat_payer: v })} />
          <span className="text-sm">Plătitor de TVA</span>
        </label>
        {editable && (
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>Salvează</Button>
          </div>
        )}
      </form>
    </>
  );
}
