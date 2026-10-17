import { describe, expect, it } from "vitest";
import { parseCompleted, tutorialForPath, tutorials } from "./tutorials";

describe("tutoriale", () => {
  it("fiecare tutorial are cel puțin un pas complet", () => {
    for (const t of Object.values(tutorials)) {
      expect(t.steps.length).toBeGreaterThan(0);
      for (const s of t.steps) {
        expect(s.selector.length).toBeGreaterThan(0);
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });

  it("mapează paginile implementate la tutoriale", () => {
    expect(tutorialForPath("/acasa")?.key).toBe("acasa");
    expect(tutorialForPath("/documente/sale")?.key).toBe("vanzari");
    expect(tutorialForPath("/documente/expense")?.key).toBe("cumparari");
    expect(tutorialForPath("/banca")?.key).toBe("banca");
    expect(tutorialForPath("/contabilitate")?.key).toBe("contabilitate");
    expect(tutorialForPath("/rapoarte")?.key).toBe("rapoarte");
    expect(tutorialForPath("/nomenclatoare")?.key).toBe("nomenclatoare");
    expect(tutorialForPath("/nomenclatoare/partner")?.key).toBe("nomenclator");
    expect(tutorialForPath("/intreprindere")?.key).toBe("intreprindere");
  });

  it("nu oferă tutorial pentru module neimplementate", () => {
    expect(tutorialForPath("/modul/depozit")).toBeNull();
    expect(tutorialForPath("/modul/personal")).toBeNull();
  });

  it("parsează lista de tutoriale finalizate", () => {
    expect(parseCompleted(null)).toEqual([]);
    expect(parseCompleted("nu-e-json")).toEqual([]);
    expect(parseCompleted('["acasa",5,"banca"]')).toEqual(["acasa", "banca"]);
  });
});
