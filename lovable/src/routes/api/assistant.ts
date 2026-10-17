import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/assistant")({
  server: { handlers: { POST: async ({ request }) => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const aiKey = process.env['LOVABLE_API_KEY'];
    if (!url || !key || !aiKey) return Response.json({ error: "Asistentul nu este configurat și nu este disponibil." }, { status: 503 });
    const { runAssistant } = await import("@/lib/assistant.server");
    try { return await runAssistant(request, { url, key, aiKey }); }
    catch { return Response.json({ error: "Asistentul nu este disponibil acum." }, { status: 500 }); }
  } } },
});
