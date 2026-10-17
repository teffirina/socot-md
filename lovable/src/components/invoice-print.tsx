import { Printer } from "lucide-react";
import type { Doc } from "@/lib/documents";
import { readInvoice, emptyParty, type InvoiceParty } from "@/lib/invoice";
import { useMembership } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const lei = (v: number | null | undefined) => v === null || v === undefined ? "" : (v / 100).toLocaleString("ro-MD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0|\u202f/g, " ");
const date = (v: string | null | undefined) => v ? v.split("-").reverse().join(".") : "";

function Party({ n, ro, ru, p }: { n: string; ro: string; ru: string; p: InvoiceParty }) {
  return <tr><td colSpan={3} className="b"><b>{n}. {ro}</b> <span className="ru">{ru}</span><div className="val">{p.name}{p.address ? `, ${p.address}` : ""}{p.iban ? ` · IBAN ${p.iban}` : ""}{p.bank ? ` · ${p.bank}` : ""}{p.bankCode ? ` (${p.bankCode})` : ""}</div></td><td colSpan={2} className="b"><b>c.f./ nr.TVA</b> <span className="ru">ф.к./ код НДС</span><div className="val mono">{p.fiscalCode}{p.vatCode ? ` / ${p.vatCode}` : ""}</div></td></tr>;
}

export function InvoicePrintSheet({ doc }: { doc: Doc }) {
  const { company } = useMembership();
  const inv = readInvoice(doc.invoice_details);
  const own: InvoiceParty = { ...emptyParty(), name: company.name, fiscalCode: company.idno, address: company.address, iban: company.iban, bank: company.bank };
  const other: InvoiceParty = { ...emptyParty(), name: doc.partner_name };
  const supplier = inv?.supplier.name ? inv.supplier : doc.kind === "sale" ? own : other;
  const customer = inv?.customer.name ? inv.customer : doc.kind === "sale" ? other : own;
  const lines = inv?.lines.length ? inv.lines : [{ name: doc.description || "Bunuri / servicii", unit: "buc", quantity: "1", unitPrice: inv?.net ?? doc.total, net: inv?.net ?? doc.total, vatRate: "0", vat: inv?.vat ?? 0 }];
  const net = inv?.net ?? lines.reduce((s, l) => s + (l.net ?? 0), 0);
  const vat = inv?.vat ?? lines.reduce((s, l) => s + (l.vat ?? 0), 0);
  const total = inv?.total ?? doc.total;
  const empty = Math.max(0, 6 - lines.length);
  return <div className="invoice-sheet">
    <p className="right">Anexa nr.1 · Republica Moldova</p>
    <div className="head"><div><b>FACTURĂ FISCALĂ</b> Seria <u>{inv?.series ?? ""}</u> Nr. <u>{inv?.number ?? doc.number}</u><br /><span className="ru">НАЛОГОВАЯ НАКЛАДНАЯ</span></div>{inv && inv.currency !== "MDL" && <div>Moneda: {inv.currency} · curs {inv.exchangeRate}</div>}</div>
    <table className="frame"><tbody>
      <tr><td colSpan={3} className="b"><b>Data eliberării / data livrării</b> <span className="ru">Дата выписки / дата поставки</span><div className="val mono">{date(inv?.issueDate ?? doc.date)} / {date(inv?.deliveryDate ?? inv?.issueDate ?? doc.date)}</div></td><td colSpan={2} className="b"><b>8. Foaia de parcurs</b> <span className="ru">Путевой лист</span><div className="val" /></td></tr>
      <tr><td colSpan={3} className="b"><b>Termen de plată</b> <span className="ru">Срок оплаты</span><div className="val mono">{date(inv?.dueDate)}</div></td><td colSpan={2} className="b"><b>9. Transportator</b> <span className="ru">Перевозчик</span><div className="val" /></td></tr>
      <Party n="1" ro="Furnizor:" ru="Поставщик" p={supplier} />
      <Party n="2" ro="Cumpărător/beneficiar:" ru="Покупатель/получатель" p={customer} />
      <tr><td colSpan={3} className="b"><b>3. Delegație</b> <span className="ru">Доверенность</span><div className="val" /></td><td colSpan={2} className="b"><b>4. Documente anexate</b> <span className="ru">Прилагаемые документы</span><div className="val">{[inv?.contract, inv?.reference].filter(Boolean).join(" · ")}</div></td></tr>
      <tr><td className="b"><b>5. Punct încărcare</b><div className="val" /></td><td colSpan={2} className="b"><b>6. Punct descărcare</b><div className="val" /></td><td colSpan={2} className="b"><b>7. Redirijări</b><div className="val" /></td></tr>
    </tbody></table>
    <table className="lines"><thead><tr>
      {["10.1 Denumirea mărfurilor / serviciilor", "10.2 Unitatea de măsură", "10.3 Cantitatea", "10.4 Preț unitar fără TVA, lei", "10.5 Valoarea totală fără TVA, lei", "10.6 Cota TVA, %", "10.7 Suma TVA, lei", "10.8 Valoarea totală, lei", "10.9 Altă informație", "10.10 Tip ambalaj", "10.11 Număr locuri", "10.12 Masa brută, t"].map(h => <th key={h}>{h}</th>)}
    </tr></thead><tbody>
      {lines.map((l, i) => <tr key={i}><td className="left">{l.name}</td><td>{l.unit}</td><td className="num">{l.quantity}</td><td className="num">{lei(l.unitPrice)}</td><td className="num">{lei(l.net)}</td><td className="num">{l.vatRate}</td><td className="num">{lei(l.vat)}</td><td className="num">{lei(l.net === null || l.vat === null ? null : l.net + l.vat)}</td><td /><td /><td /><td /></tr>)}
      {Array.from({ length: empty }, (_, i) => <tr key={`e${i}`} className="blank">{Array.from({ length: 12 }, (_, j) => <td key={j} />)}</tr>)}
      <tr><td colSpan={4} className="left"><b>11. TOTAL (pe pagină)</b> <span className="ru">Всего (по странице)</span></td><td className="num">{lei(net)}</td><td>x</td><td className="num">{lei(vat)}</td><td className="num">{lei(total)}</td><td>x</td><td>x</td><td>x</td><td /></tr>
      <tr><td colSpan={4} className="left"><b>12. TOTAL (pe factura fiscală)</b> <span className="ru">Всего (по налоговой накладной)</span></td><td className="num">{lei(net)}</td><td>x</td><td className="num">{lei(vat)}</td><td className="num">{lei(total)}</td><td>x</td><td>x</td><td>x</td><td /></tr>
    </tbody></table>
    <div className="sign">
      {[["13. Permis eliberarea:", "Отпуск разрешил"], ["14. Predat mărfurile/activele (serviciile):", "Сдал товары/активы (услуги)"], ["15. Primit mărfurile/activele (serviciile):", "Получил товары/активы (услуги)"]].map(([ro, ru]) => <div key={ro}><b>{ro}</b> <span className="ru">{ru}</span><div className="line" /><small>Funcția, numele, prenumele și semnătura · L.Ș.</small></div>)}
    </div>
  </div>;
}

export function InvoicePrintDialog({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
    <DialogContent className="invoice-print-dialog top-[3dvh] block max-h-[94dvh] w-[calc(100%-1rem)] max-w-5xl translate-y-0 space-y-4 overflow-y-auto">
      <DialogHeader className="no-print"><DialogTitle className="font-display text-2xl">Factura fiscală {doc.number}</DialogTitle><DialogDescription>Previzualizare în formatul tipizat. Verifică datele înainte de a tipări.</DialogDescription></DialogHeader>
      <div className="no-print flex gap-2"><Button data-t="invoice-print-button" onClick={() => window.print()}><Printer />Tipărește</Button><Button variant="ghost" onClick={onClose}>Închide</Button></div>
      <div className="overflow-x-auto"><InvoicePrintSheet doc={doc} /></div>
    </DialogContent>
  </Dialog>;
}
