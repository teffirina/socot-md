import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { kindNames, type Doc, type DocKind } from "@/lib/documents";
import { money, parseMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
const today = () => new Date().toISOString().slice(0, 10);

export function PayDialog({ doc, onClose, onDone }: { doc: Doc; onClose: () => void; onDone: () => void }) {
  const rest = doc.total - doc.paid;
  const [amount, setAmount] = useState((rest / 100).toFixed(2).replace(".", ","));
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const value = parseMoney(amount);
    if (!value) return void toast.error("Sumă invalidă.");
    setBusy(true);
    const { error } = await supabase.rpc("add_payment", { _doc: doc.id, _amount: value, _date: date });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Plata a fost înregistrată.");
    onDone();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{kindNames[doc.kind as DocKind].pay}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {doc.number} · {doc.partner_name} · rest {money(rest)}
        </p>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Suma, MDL</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Renunță
            </Button>
            <Button type="submit" disabled={busy}>
              Înregistrează
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
