import { z } from "zod";
import { sendJson } from "../_lib/json.js";
import { requireUser } from "../_lib/health/auth.js";
import { parseBody, route, todayQuery } from "../_lib/health/http.js";
import { computeStats } from "../_lib/health/stats.js";
import { dayTotals, updateDisplayName } from "../_lib/health/store.js";
import { DISPLAY_NAME_MAX } from "../_lib/health/users.js";

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
});

export default route({
  GET: async (req, res) => {
    const today = todayQuery(req);
    const user = await requireUser(req);
    sendJson(res, 200, { user, stats: computeStats(await dayTotals(user.id), today) });
  },
  PATCH: async (req, res) => {
    const user = await requireUser(req);
    const { displayName } = parseBody(req, patchSchema);
    sendJson(res, 200, { user: await updateDisplayName(user.id, displayName) });
  },
});
