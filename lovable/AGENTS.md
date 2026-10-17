<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Socot architecture
- Port of github.com/teffirina/socot-md (web only); original source is reference, not copied runtime. Why: Next/Express/Prisma/Tauri don't run here.
- Data is multi-tenant per company: every table has company_id; access via public.has_perm(company, perm) in RLS. Why: roles are per company, mirrored in src/lib/permissions.ts.
- State-changing accounting ops (confirm document, payments, posting) go through security-definer SQL functions only. Why: document + journal must change atomically and confirmed docs are immutable.
- Money is stored as integer bani (bigint). Why: no float rounding.
- Remaining modules tracked in roadmap.md.
- Universal creation reuses DocumentCreateDialog and the shared PayDialog; unsupported accounting creation stays hidden, and payments select confirmed unpaid company documents. Why: avoid duplicate forms and preserve existing atomic accounting operations.
- Home demo fixtures live in a browser-safe presentation module and are never persisted; a separate company-data view keeps existing live calculations. Why: visual examples must not masquerade as company balances.
- The authenticated shell preserves the existing seven expandable navigation groups, company/account controls and mobile drawer; Home alone owns its redesigned layout and header search, with larger controls scoped to dashboard-main. Why: overview presentation changes must not replace shared workflows or global control sizing.
- Home financial indicators derive from the shared documents query and an inclusive document-date range; mutation invalidation keeps profit current without a separate stored balance. Why: avoid divergent totals and preserve confirmed-document accounting semantics.
- Leaf routes declare their own social and description metadata, using pageMeta for shared defaults. Why: prevent unrelated root descriptions from appearing on distinct pages.
- Universal search lives in the authenticated shell and uses company-scoped browser queries enforced by RLS; record/account search parameters focus existing rows, and account labels share one module. Why: preserve existing workflows and permission boundaries without privileged search access.
- Catalog detail back navigation uses TanStack history and is disabled when history has no preceding entry. Why: return to the actual referring page without inventing a fixed destination.
- Invoice scanning uses an authenticated streaming server route and server-only Gateway helpers; reviewed extraction is stored in documents.invoice_details as JSON with integer bani. Why: retain invoice fields without altering existing confirmation, payment, or journal rules.
- Invoice AI access blocks are stored company-scoped in invoice_ai_state with service-role-only access after caller authorization. Why: terminal denials survive reloads and cannot be cleared by ordinary clients.
- Complete invoices extend the legacy extraction schema outside AI calls; versioned JSON holds currency and fiscal snapshots while documents.total and payments stay MDL. Why: preserve existing scans and accounting reports without mixing currencies.
- Invoice attachments use a private company-scoped bucket with short-lived signed links; database validation enforces duplicate checks, line totals, ownership and confirmed-document immutability. Why: UI validation alone cannot protect accounting records.
- Asistent Socot streams from an authenticated server route; its read-only tools query with the caller's token so RLS and has_perm apply, and history is stored per user and company. Why: answers must use real permitted data and never change documents.
