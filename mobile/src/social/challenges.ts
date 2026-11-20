import { exerciseNoun } from "../program/catalog";
import { daysBetween } from "../program/dates";
import type { Challenge } from "./types";

export type ChallengeGroups = {
  /** Invitations waiting for your answer. */
  incoming: Challenge[];
  /** Your invitations the friend has not answered yet. */
  sent: Challenge[];
  active: Challenge[];
  /** Completed and declined. */
  finished: Challenge[];
};

export function groupChallenges(list: Challenge[]): ChallengeGroups {
  const groups: ChallengeGroups = { incoming: [], sent: [], active: [], finished: [] };
  for (const c of list) {
    if (c.status === "pending") (c.iAmCreator ? groups.sent : groups.incoming).push(c);
    else if (c.status === "active") groups.active.push(c);
    else groups.finished.push(c);
  }
  return groups;
}

export const dayWord = (n: number) => (n === 1 ? "dag" : "dager");

/** Length in days: from `days` when sent, else from the dates once started. */
export function challengeDays(c: Pick<Challenge, "days" | "startsOn" | "endsOn">): number | null {
  if (c.days) return c.days;
  return c.startsOn && c.endsOn ? daysBetween(c.startsOn, c.endsOn) + 1 : null;
}

export function challengeTitle(c: Pick<Challenge, "type" | "exercise" | "target" | "days" | "startsOn" | "endsOn">): string {
  const noun = exerciseNoun(c.exercise ?? "pushups");
  if (c.type === "first_to_target") return `Først til ${c.target ?? "?"} ${noun}`;
  const days = challengeDays(c);
  return days ? `Flest ${noun} på ${days} ${dayWord(days)}` : `Flest ${noun}`;
}

export type Outcome = "Vunnet" | "Tapt" | "Uavgjort" | "Avslått";

export function challengeOutcome(c: Challenge): Outcome | null {
  if (c.status === "declined") return "Avslått";
  if (c.status !== "completed") return null;
  if (!c.winnerUserId) return "Uavgjort";
  return c.winnerUserId === c.me.userId ? "Vunnet" : "Tapt";
}

/** Plain-text position, so status never relies on colour. */
export function standing(c: Challenge): string {
  const diff = c.me.total - c.opponent.total;
  if (diff > 0) return `Du leder med ${diff}`;
  if (diff < 0) return `Du ligger ${-diff} bak`;
  return "Likt så langt";
}

export function daysLeftLabel(daysLeft: number | null): string | null {
  if (daysLeft == null) return null;
  if (daysLeft <= 1) return "Siste dag";
  return `${daysLeft} dager igjen`;
}

/** Bar lengths 0–1: share of the target, or of the leader's total when there is no target. */
export function challengeProgress(c: Challenge): { me: number; opponent: number } {
  const scale = c.type === "first_to_target" && c.target ? c.target : Math.max(c.me.total, c.opponent.total);
  if (!scale) return { me: 0, opponent: 0 };
  const clamp = (n: number) => Math.min(1, Math.max(0, n / scale));
  return { me: clamp(c.me.total), opponent: clamp(c.opponent.total) };
}
