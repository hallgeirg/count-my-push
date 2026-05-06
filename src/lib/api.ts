import type { AppState } from "../types";

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function fetchState(tz: string): Promise<AppState> {
  const r = await fetch(`/api/state?tz=${encodeURIComponent(tz)}`);
  if (!r.ok) throw new Error(await parseError(r));
  return (await r.json()) as AppState;
}

export async function postEntry(count: number): Promise<{
  entry: { id: number; count: number; performedAt: string };
}> {
  const r = await fetch("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return (await r.json()) as {
    entry: { id: number; count: number; performedAt: string };
  };
}

export async function deleteEntry(id: number): Promise<void> {
  const r = await fetch(`/api/entries?id=${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error(await parseError(r));
}

export async function patchGoals(partial: {
  dailyGoal?: number;
  weeklyGoal?: number;
  monthlyGoal?: number;
}): Promise<AppState["goals"]> {
  const r = await fetch("/api/goals", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  if (!r.ok) throw new Error(await parseError(r));
  const j = (await r.json()) as { goals: AppState["goals"] };
  return j.goals;
}

export async function patchSettings(quickAdd: number[]): Promise<number[]> {
  const r = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quickAdd }),
  });
  if (!r.ok) throw new Error(await parseError(r));
  const j = (await r.json()) as { quickAdd: number[] };
  return j.quickAdd;
}
