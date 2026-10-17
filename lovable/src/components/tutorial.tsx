import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markCompleted, tutorialForPath, type Tutorial, type TutorialStep } from "@/lib/tutorials";

type Rect = { top: number; left: number; width: number; height: number };

export function TutorialButton({ userId }: { userId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const close = (done: boolean) => {
    if (done && tutorial) {
      markCompleted(userId, tutorial.key);
      toast.success(`Tutorialul „${tutorial.title}” a fost finalizat.`);
    }
    setTutorial(null);
    setRect(null);
  };

  const start = () => {
    const t = tutorialForPath(pathname);
    if (!t) {
      toast.info("Pentru această pagină nu există încă un tutorial.");
      return;
    }
    const available = t.steps.filter((s) => document.querySelector(s.selector));
    if (available.length === 0) {
      toast.info("Elementele tutorialului nu sunt vizibile acum pe pagină.");
      return;
    }
    setTutorial(t);
    setSteps(available);
    setIndex(0);
  };

  useEffect(() => {
    if (!tutorial) return;
    const selector = steps[index]?.selector;
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const timer = setTimeout(update, 350);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [tutorial, index, steps]);

  useEffect(() => {
    if (!tutorial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial]);

  const popoverStyle = (): React.CSSProperties => {
    if (!rect) return {};
    const width = 320;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
    const below = rect.top + rect.height + 16;
    const style: React.CSSProperties = { position: "fixed", width, left };
    if (below + 220 < window.innerHeight) style.top = below;
    else style.top = Math.max(16, rect.top - 220 - 16);
    return style;
  };

  return (
    <>
      <Button
        onClick={start}
        className="fixed top-4 right-5 z-[90] rounded-full shadow-none"
        aria-label="Pornește tutorialul paginii"
      >
        <CircleHelp />
        Tutorial
      </Button>
      {tutorial &&
        rect &&
        createPortal(
          <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={`Tutorial: ${tutorial.title}`}>
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                top: rect.top - 6,
                left: rect.left - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                borderRadius: 12,
                border: "2px solid var(--accent)",
                boxShadow: "0 0 0 9999px rgba(16, 32, 27, 0.55)",
                pointerEvents: "none",
              }}
            />
            <div className="rounded-xl border bg-card p-5" style={popoverStyle()}>
              <p className="eyebrow">
                Pasul {index + 1} din {steps.length}
              </p>
              <h3 className="mt-1 font-display text-lg">{steps[index]?.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{steps[index]?.body}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => close(false)}>
                  Omite
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                    Înapoi
                  </Button>
                  {index < steps.length - 1 ? (
                    <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                      Următorul
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => close(true)}>
                      Finalizează
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
