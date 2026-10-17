import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mark } from "./index";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "signup" } => (s["mode"] === "signup" ? { mode: "signup" } : {}),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Autentificare — Socot" },
      { name: "description", content: "Intră în contul Socot sau creează o întreprindere nouă." },
      { property: "og:title", content: "Autentificare — Socot" },
      { property: "og:description", content: "Intră în contul Socot sau creează o întreprindere nouă." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [signup, setSignup] = useState(search.mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/acasa", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (signup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/acasa", data: { company_name: company } },
        });
        if (error) throw error;
        toast.success("Verifică emailul pentru a confirma contul.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/acasa", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare la autentificare");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Nu s-a putut intra cu Google.");
    else if (!r.redirected) navigate({ to: "/acasa", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-soft">
        <Mark />
        <h1 className="mt-6 font-display text-3xl">{signup ? "Creează cont" : "Intră în Socot"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {signup ? "Primești o întreprindere proprie, cu rol de administrator." : "Spațiul tău financiar, la îndemână."}
        </p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {signup && (
            <div className="grid gap-1.5">
              <Label htmlFor="company">Denumirea întreprinderii</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="SRL Exemplu" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Parolă</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            {signup ? "Creează cont" : "Intră"}
          </Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> sau <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" size="lg" className="w-full" onClick={google}>
          Continuă cu Google
        </Button>
        <button type="button" className="mt-5 w-full text-sm text-success hover:underline" onClick={() => setSignup(!signup)}>
          {signup ? "Am deja cont" : "Nu ai cont? Creează unul"}
        </button>
      </div>
    </main>
  );
}
