"use client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { normalizeSearch as normalize } from "../lib/workspaces";
import { navIcons } from "./nav-icons";

type Entry = { label: string; icon: string; items: string[] };

const label = (v: string) => (v === "Acasă" ? "Privire de ansamblu" : v);

// Menu grouped as in Socot.md-GLIA; a group opens on click or when it holds the current page.
export default function SideNav({
  active,
  query,
  journal,
  go,
}: {
  active: string;
  query: string;
  journal: boolean;
  go: (view: string) => void;
}) {
  const entries: Entry[] = [
    { label: "Acasă", icon: "Acasă", items: ["Acasă"] },
    {
      label: "Spațiu de lucru",
      icon: "Spațiu de lucru",
      items: ["Spațiu de lucru"],
    },
    {
      label: "Vânzări și cumpărări",
      icon: "Cumpărări",
      items: ["Vânzări", "Cumpărări"],
    },
    { label: "Bancă și casă", icon: "Bancă și casă", items: ["Bancă și casă"] },
    {
      label: "Depozit și producție",
      icon: "Depozit",
      items: ["Depozit", "Producție"],
    },
    { label: "Active", icon: "Active", items: ["Active"] },
    {
      label: "Personal și salarii",
      icon: "Personal și salarii",
      items: ["Personal și salarii"],
    },
    {
      label: "Contabilitate și rapoarte",
      icon: "Contabilitate",
      items: [...(journal ? ["Contabilitate"] : []), "Rapoarte"],
    },
    {
      label: "Administrare",
      icon: "Setări",
      items: ["Nomenclatoare", "Întreprindere", "Setări"],
    },
  ];
  const [open, setOpen] = useState<string[]>([]);
  const q = normalize(query.trim());
  const shown = entries
    .map((e) => ({
      ...e,
      items: q
        ? e.items.filter((v) => normalize(`${e.label} ${label(v)}`).includes(q))
        : e.items,
    }))
    .filter((e) => e.items.length);
  return (
    <nav aria-label="Navigare principală" className="side-nav">
      {shown.map((e) => {
        const Icon = navIcons[e.icon];
        const single = e.items.length === 1 && e.items[0] === e.label;
        const current = e.items.includes(active);
        if (single)
          return (
            <button
              key={e.label}
              className={current ? "active" : ""}
              aria-current={current ? "page" : undefined}
              onClick={() => go(e.label)}
            >
              {Icon && <Icon size={17} strokeWidth={1.8} aria-hidden />}
              {label(e.label)}
            </button>
          );
        const expanded = !!q || current || open.includes(e.label);
        const Chevron = expanded ? ChevronDown : ChevronRight;
        return (
          <div key={e.label} className="side-group">
            <button
              aria-expanded={expanded}
              className={current ? "group current" : "group"}
              onClick={() =>
                setOpen(
                  open.includes(e.label)
                    ? open.filter((x) => x !== e.label)
                    : [...open, e.label],
                )
              }
            >
              {Icon && <Icon size={17} strokeWidth={1.8} aria-hidden />}
              <span>{e.label}</span>
              <Chevron size={15} aria-hidden className="chevron" />
            </button>
            {expanded &&
              e.items.map((v) => (
                <button
                  key={v}
                  className={`sub ${active === v ? "active" : ""}`}
                  aria-current={active === v ? "page" : undefined}
                  onClick={() => go(v)}
                >
                  {label(v)}
                </button>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
