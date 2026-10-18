"use client";
import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Kind = "sale" | "expense";

// Shows a QR code; the phone photographs the invoice and this computer then scans it with AI.
export default function PhoneScanDialog({
  onFile,
  onClose,
}: {
  onFile: (kind: Kind, file: File) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>("expense");
  const [link, setLink] = useState<{
    token: string;
    url: string;
    qr: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("/phone-scan/start", {})
      .then((r) => active && setLink(r))
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof Error
              ? e.message
              : "Scanarea cu telefonul merge când serverul Socot rulează pe acest calculator.",
          ),
      );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!link) return;
    const timer = setInterval(async () => {
      try {
        const r = await api("/phone-scan/poll", { token: link.token });
        if (r.status === "expired") {
          clearInterval(timer);
          setError("Codul QR a expirat. Închide și deschide din nou scanarea.");
        } else if (r.status === "ready") {
          clearInterval(timer);
          const bytes = Uint8Array.from(atob(r.file.data), (c) =>
            c.charCodeAt(0),
          );
          onFile(kind, new File([bytes], r.file.name, { type: r.file.type }));
        }
      } catch {
        // A missed poll is retried on the next tick.
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [link, kind, onFile]);
  return (
    <div className="modalback">
      <section
        className="modal phone-scan"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-scan-title"
      >
        <p className="eyebrow">Scanare cu telefonul</p>
        <h2 id="phone-scan-title">Fă poză facturii cu telefonul</h2>
        <div
          className="phone-kind"
          role="radiogroup"
          aria-label="Tipul facturii"
        >
          {(
            [
              ["expense", "De la furnizor"],
              ["sale", "Către client"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              className={kind === value ? "" : "secondary"}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : link ? (
          <>
            <img
              className="phone-qr"
              alt="Cod QR pentru telefon"
              src={`data:image/svg+xml;utf8,${encodeURIComponent(link.qr)}`}
            />
            <ol className="phone-steps">
              <li>
                Telefonul trebuie să fie în aceeași rețea Wi-Fi cu acest
                calculator.
              </li>
              <li>Deschide camera telefonului și îndreapt-o spre cod.</li>
              <li>Apasă „Fă o poză” sau alege un PDF.</li>
            </ol>
            <p className="muted phone-wait" role="status">
              <Smartphone size={15} aria-hidden /> Aștept factura de la telefon…
            </p>
            <p className="footnote">
              Dacă nu se deschide, scrie în browserul telefonului: {link.url}
            </p>
          </>
        ) : (
          <p role="status">Se pregătește codul QR…</p>
        )}
        <div className="controls">
          <button type="button" className="secondary" onClick={onClose}>
            Închide
          </button>
        </div>
      </section>
    </div>
  );
}
