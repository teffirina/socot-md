import { calculateDocumentLines } from "./document-lines";
import {
  catalogOperationSchema,
  validateDocumentReferences,
  validateCatalogChange,
  type CatalogEntry,
  type CatalogPending,
} from "./catalog";
import {
  initialCompliance,
  demoRules,
  assertPeriodOpen,
  selectRule,
  type ComplianceState,
} from "./compliance";
import { demoData } from "./demo";
import {
  draftSchema,
  invoiceFromDraft,
  type DocumentDraft,
} from "./document-workflow";
import { api, ApiError } from "./api";
import {
  applyOperation,
  journalEntries,
  operationKind,
  type Invoice,
  type Pending,
} from "./domain";
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
    if (this.demo && this.state.compliance) {
      const existing = this.state.compliance.rules;
      this.state.compliance.rules = [
        ...existing,
        ...demoRules.filter(
          (r) =>
            ["expense", "payment"].includes(r.kind) &&
            !existing.some((x) => x.kind === r.kind),
        ),
      ];
    }
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
  async saveDraft(value: DocumentDraft) {
    if (this.running) throw Error("Sincronizare în curs. Reîncearcă imediat.");
    const draft = draftSchema.parse(value);
    if (draft.lines) {
      try {
        draft.total = calculateDocumentLines(draft.lines).total;
      } catch {
        draft.total = 0;
      } // Incomplete input remains editable; never use an old total.
    }
    if (
      this.state.invoices.some((i) => i.id === draft.id) ||
      this.state.pending.some((p) => p.invoice.id === draft.id)
    )
      throw Error(
        "Documentul este deja confirmat și nu mai poate fi editat ca ciornă.",
      );
    const previous = this.state.drafts?.find((d) => d.id === draft.id);
    if ((previous?.revision ?? 0) !== draft.revision)
      throw Error("Ciorna s-a modificat. Redeschide documentul.");
    if (!previous && (this.state.drafts?.length ?? 0) >= 100)
      throw Error(
        "Sunt deja 100 de ciorne locale. Confirmă documentele pregătite.",
      );
    this.running = true;
    try {
      await this.commit({
        ...this.state,
        drafts: [
          ...(this.state.drafts ?? []).filter((d) => d.id !== draft.id),
          { ...draft, revision: draft.revision + 1 },
        ],
      });
    } finally {
      this.running = false;
    }
  }
  async confirmDraft(id: string, revision: number) {
    const draft = this.state.drafts?.find((d) => d.id === id);
    if (!draft || draft.revision !== revision)
      throw Error("Ciorna s-a modificat. Verifică din nou documentul.");
    await this.enqueue(invoiceFromDraft(draft), id);
  }
  async enqueue(invoice: Invoice, draftId?: string) {
    if (this.running)
      throw new Error("Sincronizare în curs. Reîncearcă imediat.");
    this.running = true;
    try {
      await this.storeOperation(invoice, draftId);
    } finally {
      this.running = false;
    }
    await this.sync();
  }
  private async storeOperation(invoice: Invoice, draftId?: string) {
    if (this.state.pending.some((p) => p.invoice.id === invoice.id))
      throw new Error(
        "Sincronizează sau rezolvă operațiunea anterioară pentru această factură.",
      );
    const op: Pending = {
      id: crypto.randomUUID(),
      baseVersion: invoice.version,
      effectiveDate:
        invoice.version === 0
          ? invoice.date
          : new Date().toISOString().slice(0, 10),
      invoice,
    };
    if (this.demo) {
      const old = this.state.invoices.find((i) => i.id === invoice.id) ?? null;
      if (!old) validateDocumentReferences(this.state.catalog ?? [], invoice);
      const compliance = this.state.compliance ?? initialCompliance();
      assertPeriodOpen(compliance.periods, op.effectiveDate!);
      const rule = selectRule(
        compliance.rules,
        operationKind(invoice, !!old),
        op.effectiveDate!,
        true,
      );
      const next = applyOperation(old, op);
      await this.commit({
        ...this.state,
        drafts: (this.state.drafts ?? []).filter((d) => d.id !== draftId),
        compliance: {
          ...compliance,
          audit: [
            {
              id: crypto.randomUUID(),
              action: `${operationKind(invoice, !!old)}.created`,
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
          ...journalEntries(
            old,
            next,
            compliance.rules,
            op.effectiveDate,
            true,
          ).map((entry, index) => ({
            id: index === 0 ? op.id : `${op.id}:${index + 1}`,
            invoiceId: invoice.id,
            operationId: op.id,
            lineNo: index + 1,
            ...entry,
            effectiveDate: op.effectiveDate,
            ruleId: rule.id,
            ruleVersion: rule.version,
            state: "proposed" as const,
          })),
        ],
      });
      return;
    }
    await this.commit({
      ...this.state,
      drafts: (this.state.drafts ?? []).filter((d) => d.id !== draftId),
      pending: [...this.state.pending, op],
    });
  }
  async saveCatalog(entry: CatalogEntry, reason: string) {
    if (this.running) throw Error("Sincronizare în curs. Reîncearcă imediat.");
    if (this.state.catalogPending?.some((p) => p.entry.id === entry.id))
      throw Error("Rezolvă operațiunea locală anterioară înainte de editare.");
    const op = catalogOperationSchema.parse({
      id: crypto.randomUUID(),
      entry,
      baseVersion: entry.version,
      reason,
    });
    if (this.demo) {
      const next = validateCatalogChange(this.state.catalog ?? [], op);
      const compliance = this.state.compliance ?? initialCompliance();
      await this.commit({
        ...this.state,
        catalog: [
          ...(this.state.catalog ?? []).filter((e) => e.id !== entry.id),
          next,
        ],
        compliance: {
          ...compliance,
          audit: [
            {
              id: op.id,
              actor: "Utilizator demo",
              action: "catalog.saved",
              objectId: entry.id,
              reason,
              at: new Date().toISOString(),
            },
            ...compliance.audit,
          ],
        },
      });
      return;
    }
    await this.commit({
      ...this.state,
      catalogPending: [...(this.state.catalogPending ?? []), op],
    });
    await this.sync();
  }
  async resolveCatalog(id: string, keepLocal: boolean) {
    if (this.running) throw Error("Sincronizare în curs");
    const p = this.state.catalogPending?.find((p) => p.id === id);
    if (!p || p.conflict === undefined) return;
    let remaining = this.state.catalogPending!.filter((p) => p.id !== id);
    if (keepLocal) {
      if (!p.conflict)
        throw Error(
          "Înregistrarea lipsește pe server. Creează una nouă după verificare.",
        );
      remaining = [
        ...remaining,
        {
          id: crypto.randomUUID(),
          entry: { ...p.entry, version: p.conflict.version },
          baseVersion: p.conflict.version,
          reason: p.reason,
        },
      ];
    }
    await this.commit({ ...this.state, catalogPending: remaining });
    await this.sync();
  }
  async discardCatalog(id: string) {
    if (this.running) throw Error("Sincronizare în curs");
    if (!this.state.catalogPending?.find((p) => p.id === id)?.error)
      throw Error("Numai operațiunile respinse pot fi retrase.");
    await this.commit({
      ...this.state,
      catalogPending: this.state.catalogPending.filter((p) => p.id !== id),
    });
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
      for (const op of [...(this.state.catalogPending ?? [])]) {
        if (op.conflict !== undefined || op.error) continue;
        try {
          const entry: CatalogEntry = await this.deps.api("/catalog", {
            id: op.id,
            entry: op.entry,
            baseVersion: op.baseVersion,
            reason: op.reason,
          });
          await this.commit({
            ...this.state,
            catalog: [
              ...(this.state.catalog ?? []).filter((e) => e.id !== entry.id),
              entry,
            ],
            catalogPending: this.state.catalogPending!.filter(
              (p) => p.id !== op.id,
            ),
          });
        } catch (e) {
          if (
            e instanceof ApiError &&
            [409, 400, 403, 422].includes(e.status)
          ) {
            await this.commit({
              ...this.state,
              catalogPending: this.state.catalogPending!.map((p) =>
                p.id === op.id
                  ? {
                      ...p,
                      ...(e.status === 409
                        ? { conflict: e.data.current ?? null }
                        : { error: e.message }),
                    }
                  : p,
              ),
            });
            continue;
          }
          throw e;
        }
      }
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
            ...this.state,
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
      const catalog: CatalogEntry[] = await this.deps.api("/catalog");
      const invoices: Invoice[] = await this.deps.api("/invoices");
      await this.commit({
        ...this.state,
        catalog,
        invoices: invoices.slice(-200),
        pending: this.state.pending,
      });
      this.changed(
        this.state,
        this.state.pending.length + (this.state.catalogPending?.length ?? 0)
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
