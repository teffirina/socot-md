import {
  initialCompliance,
  assertPeriodOpen,
  selectRule,
  type ComplianceState,
} from "./compliance";
import { demoData } from "./demo";
import { api, ApiError } from "./api";
import { applyOperation, journal, type Invoice, type Pending } from "./domain";
import { read, write, type Snapshot } from "./storage";
export class SyncEngine {
  state: Snapshot = { invoices: [], pending: [] };
  private running = false;
  constructor(
    public scope: string,
    public demo: boolean,
    public changed: (s: Snapshot, status: string) => void,
    private deps = { api, read, write },
  ) {}
  async load() {
    const saved = await this.deps.read(this.scope);
    this.state =
      saved ?? (this.demo ? demoData() : { invoices: [], pending: [] });
    if (this.demo && !this.state.compliance)
      this.state.compliance = initialCompliance();
    if (!saved && this.demo) await this.deps.write(this.scope, this.state);
    this.changed(this.state, this.demo ? "Demo local • SQLite" : "Conectare…");
  }
  async commit(state: Snapshot) {
    await this.deps.write(this.scope, state);
    this.state = state;
    this.changed(
      state,
      this.demo ? "Demo local" : `${state.pending.length} operațiuni locale`,
    );
  }
  async enqueue(invoice: Invoice) {
    if (this.running)
      throw new Error("Sincronizare în curs. Reîncearcă imediat.");
    if (this.state.pending.some((p) => p.invoice.id === invoice.id))
      throw new Error(
        "Sincronizează sau rezolvă operațiunea anterioară pentru această factură.",
      );
    const op: Pending = {
      id: crypto.randomUUID(),
      baseVersion: invoice.version,
      effectiveDate: new Date().toISOString().slice(0, 10),
      invoice,
    };
    if (this.demo) {
      const old = this.state.invoices.find((i) => i.id === invoice.id) ?? null;
      const compliance = this.state.compliance ?? initialCompliance();
      assertPeriodOpen(compliance.periods, op.effectiveDate!);
      const rule = selectRule(
        compliance.rules,
        old ? "receipt" : "sale",
        op.effectiveDate!,
        true,
      );
      const next = applyOperation(old, op);
      await this.commit({
        ...this.state,
        compliance: {
          ...compliance,
          audit: [
            {
              id: crypto.randomUUID(),
              action: old ? "receipt.created" : "invoice.created",
              objectId: invoice.id,
              reason: old
                ? "Încasare confirmată de utilizator"
                : "Factură confirmată de utilizator",
              actor: "Utilizator demo",
              at: new Date().toISOString(),
            },
            ...compliance.audit,
          ],
        },
        invoices: [
          ...this.state.invoices.filter((i) => i.id !== invoice.id),
          next,
        ],
        ledger: [
          ...(this.state.ledger ?? []),
          {
            id: op.id,
            invoiceId: invoice.id,
            ...journal(old, next, compliance.rules, op.effectiveDate, true),
            effectiveDate: op.effectiveDate,
            ruleId: rule.id,
            ruleVersion: rule.version,
            state: "proposed",
          },
        ],
      });
      return;
    }
    await this.commit({ ...this.state, pending: [...this.state.pending, op] });
    await this.sync();
  }
  async configure(compliance: ComplianceState) {
    if (!this.demo) throw new Error("Configurarea reală se face prin API");
    if (this.running) throw new Error("Sincronizare în curs");
    await this.commit({ ...this.state, compliance });
  }
  async discardRejected(id: string) {
    if (this.running) throw new Error("Sincronizare în curs");
    const p = this.state.pending.find((p) => p.id === id);
    if (!p?.error)
      throw new Error("Numai operațiunile respinse pot fi anulate aici");
    await this.commit({
      ...this.state,
      pending: this.state.pending.filter((p) => p.id !== id),
    });
  }
  async resolve(id: string, keepLocal: boolean) {
    if (this.running) throw new Error("Sincronizare în curs");
    const p = this.state.pending.find((p) => p.id === id);
    if (!p || p.conflict === undefined) return;
    let remaining = this.state.pending.filter((x) => x.id !== id);
    if (keepLocal) {
      if (!p.conflict)
        throw new Error(
          "Factura nu mai există. Păstrează versiunea serverului și creează un document nou.",
        );
      const desired = { ...p.conflict, paid: p.invoice.paid };
      if (desired.paid < p.conflict.paid)
        throw new Error(
          "Serverul are deja o încasare mai mare. Verifică documentele.",
        );
      remaining = [
        ...remaining,
        {
          id: crypto.randomUUID(),
          baseVersion: p.conflict.version,
          effectiveDate: p.effectiveDate,
          invoice: desired,
        },
      ];
    }
    await this.commit({ ...this.state, pending: remaining });
    await this.sync();
  }
  async sync() {
    if (this.running || this.demo) return;
    this.running = true;
    try {
      await this.deps.api("/health");
      this.changed(this.state, "Sincronizare…");
      for (const op of [...this.state.pending]) {
        if (op.conflict !== undefined || op.error) continue;
        try {
          const next: Invoice = await this.deps.api("/operations", {
            id: op.id,
            invoice: op.invoice,
            baseVersion: op.baseVersion,
            effectiveDate: op.effectiveDate,
          });
          await this.commit({
            invoices: [
              ...this.state.invoices.filter((i) => i.id !== next.id),
              next,
            ],
            pending: this.state.pending.filter((p) => p.id !== op.id),
          });
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            await this.commit({
              ...this.state,
              pending: this.state.pending.map((p) =>
                p.id === op.id ? { ...p, conflict: e.data.current } : p,
              ),
            });
            continue;
          }
          if (e instanceof ApiError && [400, 403, 422].includes(e.status)) {
            await this.commit({
              ...this.state,
              pending: this.state.pending.map((p) =>
                p.id === op.id ? { ...p, error: e.message } : p,
              ),
            });
            continue;
          }
          throw e;
        }
      }
      const invoices: Invoice[] = await this.deps.api("/invoices");
      await this.commit({
        invoices: invoices.slice(-200),
        pending: this.state.pending,
      });
      this.changed(
        this.state,
        this.state.pending.length
          ? "Necesită atenție"
          : "Conectat • sincronizat",
      );
    } catch (e) {
      this.changed(
        this.state,
        e instanceof ApiError && e.status === 401
          ? "Sesiune expirată • autentifică-te din nou"
          : e instanceof ApiError && e.status === 403
            ? "Acces refuzat • verifică drepturile rolului"
            : "Offline • operațiunile sunt păstrate",
      );
    } finally {
      this.running = false;
    }
  }
}
