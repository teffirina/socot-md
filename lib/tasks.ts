import { z } from "zod";
import type { Invoice } from "./domain";

// A document added by the entrepreneur becomes a task for the accountant, who
// either asks for what is missing or confirms the posting. Every step is kept
// as a message so both sides see the same history.

export const missingItems = [
  "Factura fiscală originală",
  "Contractul",
  "Actul de predare-primire",
  "Documentul de plată",
  "Scopul cheltuielii",
  "Datele contragentului (IDNO)",
] as const;

export const taskStatuses = ["todo", "needs_info", "answered", "done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const statusNames: Record<TaskStatus, string> = {
  todo: "De verificat",
  needs_info: "Așteaptă informații",
  answered: "Răspuns primit",
  done: "Înregistrare confirmată",
};

const messageSchema = z
  .object({
    id: z.uuid(),
    at: z.iso.datetime(),
    by: z.string().trim().min(1).max(80),
    kind: z.enum(["created", "request", "answer", "confirmed"]),
    text: z.string().trim().max(1000),
    items: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  })
  .strict();
export type TaskMessage = z.infer<typeof messageSchema>;

export const taskSchema = z
  .object({
    id: z.uuid(),
    invoiceId: z.uuid(),
    /** what the document is, kept so the task reads well on its own */
    ref: z.string().trim().min(1).max(200),
    status: z.enum(taskStatuses),
    createdAt: z.iso.datetime(),
    createdBy: z.string().trim().min(1).max(80),
    version: z.number().int().nonnegative(),
    messages: z.array(messageSchema).max(60),
  })
  .strict();
export type DocumentTask = z.infer<typeof taskSchema>;

export const taskActionSchema = z
  .object({
    id: z.uuid(),
    action: z.enum(["request", "answer", "confirm"]),
    baseVersion: z.number().int().nonnegative(),
    items: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
    text: z.string().trim().max(1000).default(""),
  })
  .strict();
export type TaskAction = z.input<typeof taskActionSchema>;

/** Who has to act next: the accountant, the entrepreneur, or nobody. */
export function nextActor(task: DocumentTask) {
  if (task.status === "done") return null;
  return task.status === "needs_info" ? "entrepreneur" : "accountant";
}

export function taskRef(invoice: Invoice) {
  const kind = invoice.kind === "expense" ? "Cumpărare" : "Vânzare";
  const sum = (invoice.total / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
  });
  return `${kind} · ${invoice.customer} · ${sum} lei · ${invoice.date}${
    invoice.sourceRef ? ` · ${invoice.sourceRef}` : ""
  }`.slice(0, 200);
}

export function newTask(
  invoice: Invoice,
  by: string,
  at = new Date().toISOString(),
  id: string = crypto.randomUUID(),
): DocumentTask {
  return {
    id,
    invoiceId: invoice.id,
    ref: taskRef(invoice),
    status: "todo",
    createdAt: at,
    createdBy: by,
    version: 1,
    messages: [
      {
        id: crypto.randomUUID(),
        at,
        by,
        kind: "created",
        text: "Document adăugat. Contabilul îl verifică și confirmă înregistrarea.",
        items: [],
      },
    ],
  };
}

/** Applies one step; throws CONFLICT when someone else changed the task first. */
export function applyTaskAction(
  task: DocumentTask,
  input: TaskAction,
  by: string,
  at = new Date().toISOString(),
): DocumentTask {
  const op = taskActionSchema.parse(input);
  if (op.id !== task.id) throw Error("Sarcina nu corespunde.");
  if (op.baseVersion !== task.version) throw Error("CONFLICT");
  const say = (kind: TaskMessage["kind"], status: TaskStatus) => {
    if (task.messages.length >= 60)
      throw Error("Sarcina are prea multe mesaje. Deschide una nouă.");
    return {
      ...task,
      status,
      version: task.version + 1,
      messages: [
        ...task.messages,
        {
          id: crypto.randomUUID(),
          at,
          by,
          kind,
          text: op.text,
          items: op.items,
        },
      ],
    };
  };
  if (op.action === "request") {
    if (task.status !== "todo" && task.status !== "answered")
      throw Error("Poți cere informații doar pentru o sarcină deschisă.");
    if (!op.items.length && op.text.length < 3)
      throw Error("Alege ce lipsește sau scrie întrebarea.");
    return say("request", "needs_info");
  }
  if (op.action === "answer") {
    if (task.status !== "needs_info")
      throw Error("Contabilul nu a cerut informații pentru această sarcină.");
    if (op.text.length < 2) throw Error("Scrie răspunsul pentru contabil.");
    return say("answer", "answered");
  }
  if (task.status === "done") throw Error("Înregistrarea e deja confirmată.");
  if (task.status === "needs_info")
    throw Error("Așteaptă răspunsul la informațiile cerute.");
  return say("confirmed", "done");
}
