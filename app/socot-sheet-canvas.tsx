"use client";
import { useEffect, useRef } from "react";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import Core from "@univerjs/preset-sheets-core/locales/en-US";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import Filter from "@univerjs/preset-sheets-filter/locales/en-US";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import Sort from "@univerjs/preset-sheets-sort/locales/en-US";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import Find from "@univerjs/preset-sheets-find-replace/locales/en-US";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import Validation from "@univerjs/preset-sheets-data-validation/locales/en-US";
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import Conditional from "@univerjs/preset-sheets-conditional-formatting/locales/en-US";
import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import type { IWorksheetData } from "@univerjs/core";
import type { SheetBook } from "../lib/socot-sheets";
export type SheetController = {
  snapshot: () => SheetBook;
  insertSheet: (name: string, data: Partial<IWorksheetData>) => void;
  commit: () => Promise<SheetBook>;
  activeSheet: () => string;
  rename: (name: string) => void;
};
const ro = {
  ui: {
    ribbon: {
      start: "Acasă",
      insert: "Inserare",
      formulas: "Formule",
      data: "Date",
      view: "Vizualizare",
      others: "Altele",
    },
    shortcut: {
      undo: "Anulează",
      redo: "Refă",
      cut: "Decupează",
      copy: "Copiază",
      paste: "Lipește",
    },
  },
  sheets: { tabs: { sheet: "Foaia", sheetCopy: "(Copie{0})" } },
  "sheets-ui": {
    toolbar: {
      font: "Font",
      fontSize: "Mărime font",
      bold: "Aldin",
      italic: "Cursiv",
      underline: "Subliniat",
      strikethrough: "Tăiat",
      formatPainter: "Copiază formatul",
      textColor: { main: "Culoare text" },
      fillColor: { main: "Culoare fundal" },
      border: { main: "Borduri" },
      mergeCell: { main: "Îmbinare celule" },
      horizontalAlignMode: { main: "Aliniere orizontală" },
      verticalAlignMode: { main: "Aliniere verticală" },
      textWrapMode: { main: "Încadrare text" },
    },
    sheetConfig: {
      rename: "Redenumește",
      copy: "Duplică",
      delete: "Șterge",
      hide: "Ascunde",
      unhide: "Afișează",
      changeColor: "Culoare foaie",
    },
    rightClick: {
      copy: "Copiază",
      cut: "Decupează",
      paste: "Lipește",
      insertRow: "Inserează rând",
      insertColumn: "Inserează coloană",
      delete: "Șterge",
      clear: "Golește",
    },
  },
};
function translated<T>(base: T, patch: Record<string, unknown>): T {
  const out = structuredClone(base) as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch))
    out[k] =
      v && typeof v === "object" && !Array.isArray(v)
        ? translated(
            (out[k] ?? {}) as Record<string, unknown>,
            v as Record<string, unknown>,
          )
        : v;
  return out as T;
}
export default function SheetCanvas({
  initial,
  onChange,
  onReady,
  onError,
}: {
  initial: SheetBook;
  onChange: (b: SheetBook) => void;
  onReady: (c: SheetController | null) => void;
  onError: (s: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onChange, onReady, onError });
  callbacks.current = { onChange, onReady, onError };
  useEffect(() => {
    if (!host.current) return;
    const container = document.createElement("div");
    container.style.height = "100%";
    host.current.append(container);
    let dispose = () => {};
    try {
      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: translated(
            mergeLocales(Core, Filter, Sort, Find, Validation, Conditional),
            ro,
          ),
        },
        presets: [
          UniverSheetsCorePreset({ container, ribbonType: "classic" }),
          UniverSheetsFilterPreset(),
          UniverSheetsSortPreset(),
          UniverSheetsFindReplacePreset(),
          UniverSheetsDataValidationPreset(),
          UniverSheetsConditionalFormattingPreset(),
        ],
      });
      const book = univerAPI.createWorkbook(structuredClone(initial));
      let alive = true;
      const capture = () => {
        if (alive) callbacks.current.onChange(book.save());
      };
      const sub = book.onCommandExecuted(() => queueMicrotask(capture));
      callbacks.current.onReady({
        snapshot: () => book.save(),
        insertSheet: (name, data) => {
          const names = new Set(book.getSheets().map((s) => s.getSheetName()));
          let title = name,
            n = 2;
          while (names.has(title)) title = `${name} ${n++}`;
          const rows = Math.max(
            100,
            Object.keys(data.cellData ?? {}).length + 20,
          );
          const sheet = book.create(title, rows, 52, { sheet: data });
          book.setActiveSheet(sheet);
          capture();
        },
        commit: async () => {
          await book.endEditingAsync(true);
          await univerAPI.getFormula().onCalculationResultApplied(10000);
          return book.save();
        },
        activeSheet: () => book.getActiveSheet().getSheetId(),
        rename: (n) => {
          book.setName(n);
          capture();
        },
      });
      dispose = () => {
        alive = false;
        sub.dispose();
        callbacks.current.onReady(null);
        queueMicrotask(() => {
          univer.dispose();
          container.remove();
        });
      };
    } catch (e) {
      callbacks.current.onError("Editorul nu a pornit: " + String(e));
      container.remove();
    }
    return () => dispose();
    // A workbook is mounted once; its parent keys this component by book ID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="socot-univer"
      ref={host}
      aria-label="Editor foi de calcul Socot"
    />
  );
}
