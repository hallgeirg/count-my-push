import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { sendJson } from "../json.js";
import { isDayKey } from "./days.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const dayKey = z.string().refine(isDayKey, "Expected a date as YYYY-MM-DD");

export function readBody(req: VercelRequest): unknown {
  if (req.body == null) return null;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as unknown;
    } catch {
      return null;
    }
  }
  return req.body;
}

/** Parses with zod or throws a 400 whose message names the first problem. */
export function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path.join(".");
  throw new HttpError(400, issue ? `Invalid ${path || "body"}: ${issue.message}` : "Invalid body");
}

export function parseBody<T>(req: VercelRequest, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  return parse(schema, readBody(req));
}

/** `?today=YYYY-MM-DD`, required. */
export function todayQuery(req: VercelRequest): string {
  const raw = req.query?.today;
  return parse(dayKey, Array.isArray(raw) ? raw[0] : raw);
}

type MethodHandler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

/** Dispatches by method; HttpError becomes `{ error }` with its status, anything else a logged 500. */
export function route(methods: Partial<Record<string, MethodHandler>>) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    const fn = methods[req.method ?? ""];
    if (!fn) {
      res.setHeader("Allow", Object.keys(methods).join(", "));
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: e.message });
        return;
      }
      console.error("health api error:", e instanceof Error ? (e.stack ?? e.message) : e);
      sendJson(res, 500, { error: "Server error" });
    }
  };
}
