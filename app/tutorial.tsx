"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  markCompleted,
  tutorialForView,
  type Tutorial,
  type TutorialStep,
} from "../lib/tutorials";

type Rect = { top: number; left: number; width: number; height: number };

export default function TutorialButton({
  view,
  userId,
}: {
  view: string;
  userId: string;
}) {
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [note, setNote] = useState("");
  const close = (done: boolean) => {
    if (done && tutorial) markCompleted(userId, tutorial.key);
    setTutorial(null);
    setRect(null);
  };
  useEffect(() => close(false), [view]);
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(""), 4000);
    return () => clearTimeout(timer);
  }, [note]);
  function start() {
    const t = tutorialForView(view);
    const available = t?.steps.filter((s) => {
      const r = document.querySelector(s.selector)?.getBoundingClientRect();
      return !!r && r.width > 0 && r.height > 0;
    });
    if (!t || !available?.length) {
      setNote(
        t
          ? "Elementele tutorialului nu sunt vizibile acum pe pagină."
          : "Pentru această pagină nu există încă un tutorial.",
      );
      return;
    }
    setNote("");
    setTutorial(t);
    setSteps(available);
    setIndex(0);
  }
  useEffect(() => {
    if (!tutorial) return;
    const el = document.querySelector(steps[index]?.selector ?? "");
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const timer = setTimeout(update, 350);
    update();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [tutorial, index, steps]);
  const card = (): React.CSSProperties => {
    if (!rect) return {};
    const width = Math.min(340, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, rect.left),
      window.innerWidth - width - 16,
    );
    const below = rect.top + rect.height + 16;
    return {
      width,
      left,
      top: below + 230 < window.innerHeight ? below : Math.max(16, rect.top - 246),
    };
  };
  return (
    <>
      <button
        className="secondary tutorial-button"
        onClick={start}
        aria-label="Pornește tutorialul paginii"
      >
        ? Tutorial
      </button>
      {note && (
        <span className="tutorial-note" role="status">
          {note}
        </span>
      )}
      {tutorial &&
        rect &&
        createPortal(
          <div
            className="tutorial-layer"
            role="dialog"
            aria-modal="true"
            aria-label={`Tutorial: ${tutorial.title}`}
          >
            <div
              aria-hidden="true"
              className="tutorial-spot"
              style={{
                top: rect.top - 6,
                left: rect.left - 6,
                width: rect.width + 12,
                height: rect.height + 12,
              }}
            />
            <section className="tutorial-card" style={card()}>
              <p className="eyebrow">
                PASUL {index + 1} DIN {steps.length}
              </p>
              <h3>{steps[index]?.title}</h3>
              <p className="muted">{steps[index]?.body}</p>
              <div className="controls">
                <button className="textbutton" onClick={() => close(false)}>
                  Omite
                </button>
                <button
                  className="secondary"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  Înapoi
                </button>
                {index < steps.length - 1 ? (
                  <button autoFocus onClick={() => setIndex((i) => i + 1)}>
                    Următorul
                  </button>
                ) : (
                  <button autoFocus onClick={() => close(true)}>
                    Finalizează
                  </button>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
