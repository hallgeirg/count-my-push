/** Shapes from the Make More Health API (`docs/health-api.md`). */
import type { DayKey, Effort, WorkoutKind } from "../program/types";

export type Me = { id: string; displayName: string; friendCode: string };

export type Stats = {
  currentStreak: number;
  longestStreak: number;
  weekTotal: number;
  allTimeTotal: number;
  activeToday: boolean;
};

export type AuthConfig = { clientId: string; redirectUri: string };

export type Tokens = { accessToken: string; refreshToken: string | null };

/** `exercise` is a preset goal id: pushups, situps, squats, plank or pullups. */
export type SyncEntry = { id: string; exercise: string; count: number; at: string; day: DayKey };

export type SyncSession = {
  id: string;
  day: DayKey;
  at: string;
  kind: WorkoutKind;
  levelIndex: number;
  sets: number[];
  effort: Effort;
};

export type SyncPayload = {
  today: DayKey;
  since: DayKey;
  entries: SyncEntry[];
  sessions: SyncSession[];
};

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  total: number;
  currentStreak: number;
  isMe: boolean;
};

/** `exercise` is missing from servers older than exercises; that means pushups. */
export type Leaderboard = { from: DayKey; to: DayKey; exercise?: string; rows: LeaderboardRow[] };

export type ChallengeType = "most_in_period" | "first_to_target";
export type ChallengeStatus = "pending" | "declined" | "active" | "completed";
export type Side = { userId: string; displayName: string; total: number };

export type Challenge = {
  id: string;
  type: ChallengeType;
  /** Missing from servers older than exercises; that means pushups. */
  exercise?: string;
  status: ChallengeStatus;
  startsOn: DayKey | null;
  endsOn: DayKey | null;
  /** Not in docs/health-api.md yet, but sent by the backend; lets pending challenges show their length. */
  days?: number;
  target: number | null;
  iAmCreator: boolean;
  me: Side;
  opponent: Side;
  winnerUserId: string | null;
  daysLeft: number | null;
};

export type NewChallenge =
  | { friendCode: string; exercise: string; type: "most_in_period"; days: number }
  | { friendCode: string; exercise: string; type: "first_to_target"; target: number; days: number };
