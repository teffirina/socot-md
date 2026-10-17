import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, useMembership } from "@/lib/company";
import { can, roleNames, type Role } from "@/lib/permissions";
import { Mark } from "../index";
import { UniversalSearch } from "@/components/universal-search";
import { QuickNew } from "@/components/quick-new";
import { TutorialButton } from "@/components/tutorial";
import { AssistantButton } from "@/components/assistant";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftRight,
  Building2,
  ChevronDown,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  Settings2,
  ShoppingCart,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(membershipQuery),
  component: Shell,
});

type NavItem = { label: string; to: string; params?: Record<string, string>; show?: boolean };
type NavGroup = { label: string; icon: ComponentType<{ className?: string }>; items: NavItem[] };

function Shell() {
  const { role, company } = useMembership();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const home = pathname === "/acasa";
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups: NavGroup[] = [
    {
      label: "Vânzări și cumpărări",
      icon: ShoppingCart,
      items: [
        { label: "Vânzări", to: "/modul/$slug", params: { slug: "vanzari" } },
        { label: "Cumpărări", to: "/modul/$slug", params: { slug: "cumparari" } },
      ],
    },
    {
      label: "Bancă și casă",
      icon: Landmark,
      items: [{ label: "Bancă și casă", to: "/banca" }],
    },
    {
      label: "Depozit și producție",
      icon: Package,
      items: [
        { label: "Depozit", to: "/modul/$slug", params: { slug: "depozit" } },
        { label: "Producție", to: "/modul/$slug", params: { slug: "productie" } },
      ],
    },
    {
      label: "Active",
      icon: Building2,
      items: [{ label: "Active", to: "/modul/$slug", params: { slug: "active" } }],
    },
    {
      label: "Personal și salarii",
      icon: Users,
      items: [{ label: "Personal și salarii", to: "/modul/$slug", params: { slug: "personal" } }],
    },
    {
      label: "Contabilitate și rapoarte",
      icon: ArrowLeftRight,
      items: [
        { label: "Contabilitate", to: "/contabilitate", show: can(role, "journal.read") },
        { label: "Rapoarte", to: "/rapoarte" },
      ],
    },
    {
      label: "Administrare",
      icon: Settings2,
      items: [
        { label: "Nomenclatoare", to: "/nomenclatoare" },
        { label: "Întreprindere", to: "/intreprindere" },
      ],
    },
  ];

  const itemActive = (i: NavItem) => {
    const slug = i.params?.["slug"];
    const target = slug ? i.to.replace("$slug", slug) : i.to;
    return pathname === target || pathname.startsWith(target + "/");
  };
  const groupActive = (g: NavGroup) => g.items.some(itemActive);
  const isCollapsed = (g: NavGroup) => collapsed[g.label] ?? !groupActive(g);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    router.invalidate();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-sidebar p-5 text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Mark className="text-sidebar-accent-foreground" />
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
            {company.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{company.name}</p>
            <p className="text-xs opacity-70">{roleNames[role as Role] ?? role}</p>
          </div>
        </div>
        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto" aria-label="Navigare principală">
          <Link
            to="/acasa"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-primary !text-sidebar-primary-foreground font-semibold hover:!bg-sidebar-primary", "aria-current": "page" }}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            Privire de ansamblu
          </Link>
          {groups.map((g) => {
            const items = g.items.filter((i) => i.show !== false);
            if (items.length === 0) return null;
            const isOpen = !isCollapsed(g);
            const Icon = g.icon;
            return (
              <div key={g.label}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [g.label]: isOpen }))}
                  aria-expanded={isOpen}
                  className="h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-2 text-sm font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 whitespace-normal text-left leading-5">{g.label}</span>
                  <ChevronDown className={`size-3.5 shrink-0 opacity-60 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </Button>
                {isOpen && (
                  <div className="ml-[22px] space-y-0.5 border-l border-sidebar-border pl-2">
                    {items.map((i) => (
                      <Link
                        key={i.label}
                        to={i.to as never}
                        params={i.params as never}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent"
                        activeProps={{ className: "bg-sidebar-primary !text-sidebar-primary-foreground font-semibold hover:!bg-sidebar-primary", "aria-current": "page" }}
                      >
                        {i.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border pt-4 text-xs">
          <p className="truncate opacity-70">{user.email}</p>
          <Button variant="ghost" size="sm" onClick={signOut} className="mt-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            Ieșire
          </Button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0">
        <header className={`sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-6 py-3 backdrop-blur ${home ? "lg:hidden" : ""}`}>
          <Button variant="outline" size="icon" className="shrink-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Deschide meniul">
            <Menu className="size-4" />
          </Button>
          {!home && <><span data-t="global-search"><UniversalSearch /></span><span data-t="quick-new"><QuickNew key={company.id} /></span></>}
        </header>
        <main className={home ? "dashboard-main" : "mx-auto max-w-6xl p-6 lg:p-10"}>
          <Outlet />
        </main>
        <TutorialButton userId={user.id} />
        <AssistantButton userId={user.id} />
      </div>
    </div>
  );
}
