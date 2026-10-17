"use client";
import { MessageSquare, X } from "lucide-react";
import { useEffect, useState } from "react";
import AiPanel from "./ai-panel";
import type { Invoice } from "../lib/domain";

// "Asistent Socot" button for the header; the assistant opens in a small side panel.
export default function AssistantDrawer({
  demo,
  invoices,
  role,
  company,
  navigate,
}: {
  demo: boolean;
  invoices: Invoice[];
  role: string;
  company: string;
  navigate: (view: string) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <>
      <button
        className="assistant-button"
        aria-expanded={open}
        aria-controls="assistant-drawer"
        onClick={() => setOpen(!open)}
      >
        <MessageSquare size={15} aria-hidden /> Asistent Socot
      </button>
      {open && (
        <section
          id="assistant-drawer"
          className="assistant-drawer"
          aria-label="Asistent Socot"
        >
          <div className="assistant-head">
            <MessageSquare size={18} aria-hidden />
            <div>
              <strong>Asistent Socot</strong>
              <small>Folosește doar datele firmei {company}</small>
            </div>
            <button
              className="assistant-close"
              aria-label="Închide asistentul"
              onClick={() => setOpen(false)}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="assistant-body">
            <AiPanel
              demo={demo}
              invoices={invoices}
              role={role}
              navigate={(view) => {
                setOpen(false);
                navigate(view);
              }}
            />
          </div>
        </section>
      )}
    </>
  );
}
