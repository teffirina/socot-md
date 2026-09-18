import { desktop } from "./storage";
export class ApiError extends Error {
  constructor(
    public status: number,
    public data: any,
  ) {
    super(data.error ?? `API: ${status}`);
  }
}
export async function api(path: string, body?: unknown) {
  let status: number, data: any;
  if (desktop()) {
    const { invoke } = await import("@tauri-apps/api/core");
    ({ status, data } = await invoke<{ status: number; data: any }>(
      "api_request",
      { path, body: body ?? null },
    ));
  } else {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"}${path}`,
      {
        method: body ? "POST" : "GET",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000),
      },
    );
    status = response.status;
    data = await response.json();
  }
  if (status >= 400) throw new ApiError(status, data);
  return data;
}
