import { z } from "zod";
import { sendJson } from "../_lib/json.js";
import { requireUser } from "../_lib/health/auth.js";
import { dayKey, parseBody, route } from "../_lib/health/http.js";
import { EXERCISES, MAX_ENTRY } from "../_lib/health/exercises.js";
import { computeStats } from "../_lib/health/stats.js";
import { dayTotals, replaceSnapshot } from "../_lib/health/store.js";

const clientId = z.string().min(1).max(100);
const isoTime = z.string().datetime({ offset: true });

const schema = z.object({
  today: dayKey,
  since: dayKey,
  entries: z
    .array(
      z.object({
        id: clientId,
        // Apps from before exercises existed send only pushups and no field.
        exercise: z.enum(EXERCISES).default("pushups"),
        count: z.number().int().min(1).max(MAX_ENTRY),
        at: isoTime,
        day: dayKey,
      }),
    )
    .max(5000),
  sessions: z
    .array(
      z.object({
        id: clientId,
        day: dayKey,
        at: isoTime,
        kind: z.enum(["push", "squat", "core"]),
        levelIndex: z.number().int().min(0).max(1000),
        sets: z.array(z.number().int().min(0).max(1000)).max(100),
        effort: z.enum(["easy", "good", "empty"]),
      }),
    )
    .max(2000),
});

export default route({
  POST: async (req, res) => {
    const user = await requireUser(req);
    const body = parseBody(req, schema);
    await replaceSnapshot(user.id, body.since, body.entries, body.sessions);
    sendJson(res, 200, { stats: computeStats(await dayTotals(user.id), body.today) });
  },
});
