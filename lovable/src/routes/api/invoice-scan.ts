import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/invoice-scan")({
  server: { handlers: { POST: async ({ request }) => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const aiKey = process.env['LOVABLE_API_KEY'];
    if (!url || !key || !aiKey) return Response.json({ error: "Scanarea AI nu este configurată." }, { status: 503 });
    const { scanInvoice } = await import("@/lib/invoice-scan.server");
    try { return await scanInvoice(request, { url, key, aiKey }); }
    catch { return Response.json({ error: request.signal.aborted ? "Scanare oprită." : "Nu am putut procesa factura." }, { status: request.signal.aborted ? 499 : 500 }); }
  } } },
});