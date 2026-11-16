import { z } from "zod";
import { sendJson } from "../../_lib/json.js";
import { requireUser } from "../../_lib/health/auth.js";
import { loadChallengeViews } from "../../_lib/health/challenge-views.js";
import { acceptedDates, checkRespond } from "../../_lib/health/challenges.js";
import { dayKey, HttpError, parseBody, route } from "../../_lib/health/http.js";
import { listChallenges, respondToChallenge } from "../../_lib/health/store.js";

const schema = z.object({
  id: z.string().uuid(),
  accept: z.boolean(),
  today: dayKey,
});

export default route({
  POST: async (req, res) => {
    const user = await requireUser(req);
    const { id, accept, today } = parseBody(req, schema);
    const [row] = await listChallenges(user.id, id);
    const check = row ? checkRespond(row, user.id) : "not_found";
    if (check === "not_found") throw new HttpError(404, "Challenge not found");
    if (check === "forbidden") throw new HttpError(403, "Only the invited user can respond");
    if (check === "not_pending") throw new HttpError(409, "Challenge is no longer pending");

    const updated = await respondToChallenge(id, user.id, accept, accept ? acceptedDates(today, row.days) : null);
    if (!updated) throw new HttpError(409, "Challenge is no longer pending");
    const [challenge] = await loadChallengeViews(user.id, today, id);
    sendJson(res, 200, { challenge });
  },
});
