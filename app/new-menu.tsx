"use client";
import {
  ChevronDown,
  FilePlus2,
  Plus,
  ScanLine,
  Smartphone,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { scanFileTypes } from "../lib/invoice-scan";
import PhoneScanDialog from "./phone-scan-dialog";

type Kind = "sale" | "expense";

// "+ Nou" menu: a blank sale or purchase, or an invoice read by AI into a draft.
export default function NewMenu({
  onNew,
  onScan,
}: {
  onNew: (kind: Kind) => void;
  onScan: (kind: Kind, file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const scanKind = useRef<Kind>("expense");
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        (e instanceof KeyboardEvent && e.key === "Escape") ||
        (e instanceof MouseEvent && !root.current?.contains(e.target as Node))
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const scan = (kind: Kind) => {
    scanKind.current = kind;
    setOpen(false);
    input.current?.click();
  };
  return (
    <div className="new-menu" ref={root}>
      <button
        data-t="new-invoice"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Plus size={16} aria-hidden /> Nou <ChevronDown size={15} aria-hidden />
      </button>
      {open && (
        <div className="new-menu-list" role="menu">
          <button
            role="menuitem"
            onClick={() => (setOpen(false), onNew("sale"))}
          >
            <FilePlus2 size={16} aria-hidden />
            <span>
              Vânzare nouă<small>Factură către client</small>
            </span>
          </button>
          <button
            role="menuitem"
            onClick={() => (setOpen(false), onNew("expense"))}
          >
            <FilePlus2 size={16} aria-hidden />
            <span>
              Cumpărare nouă<small>Factură de la furnizor</small>
            </span>
          </button>
          <hr />
          {(["expense", "sale"] as const).map((kind) => (
            <button key={kind} role="menuitem" onClick={() => scan(kind)}>
              <ScanLine size={16} aria-hidden />
              <span>
                Scanează factură cu AI
                <small>
                  {kind === "expense"
                    ? "De la furnizor · PDF sau poză"
                    : "Către client · PDF sau poză"}
                </small>
              </span>
            </button>
          ))}
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setPhone(true);
            }}
          >
            <Smartphone size={16} aria-hidden />
            <span>
              Scanează cu telefonul
              <small>Poză sau PDF, prin cod QR</small>
            </span>
          </button>
        </div>
      )}
      {phone && (
        <PhoneScanDialog
          onClose={() => setPhone(false)}
          onFile={(kind, file) => {
            setPhone(false);
            onScan(kind, file);
          }}
        />
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept={scanFileTypes.join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onScan(scanKind.current, file);
        }}
      />
    </div>
  );
}
