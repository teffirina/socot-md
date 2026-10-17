import { useEffect } from "react";

export function RecordFocus({ record, ready }: { record: string | undefined; ready: unknown }) {
  useEffect(() => {
    if (!record) return;
    const element = document.getElementById(`record-${record}`);
    element?.scrollIntoView({ block: "center", behavior: "instant" });
    element?.focus({ preventScroll: true });
  }, [record, ready]);
  return null;
}

export const focusedRecordClass = (selected: boolean) => selected ? "bg-accent/40 outline outline-2 outline-ring outline-offset-[-2px]" : "";