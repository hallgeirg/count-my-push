import { z } from "zod";
import { sendJson } from "../../_lib/json.js";
import { requireUser } from "../../_lib/health/auth.js";
import { listChallengeViews, loadChallengeViews } from "../../_lib/health/challenge-views.js";
import { HttpError, parseBody, route, todayQuery } from "../../_lib/health/http.js";
import { createChallenge, findUserByFriendCode } from "../../_lib/health/store.js";
import { normalizeFriendCode } from "../../_lib/health/users.js";

const friendCode = z.string().min(1).max(20);

const createSchema = z.discriminatedUnion("type", [
  z.object({
    friendCode,
    type: z.literal("most_in_period"),
    days: z.number().int().min(1).max(31),
  }),
  z.object({
    friendCode,
    type: z.literal("first_to_target"),
    target: z.number().int().min(10).max(10_000),
    days: z.number().int().min(1).max(60).default(30),
  }),
]);

export default route({
  GET: async (req, res) => {
    const today = todayQuery(req);
    const user = await requireUser(req);
    sendJson(res, 200, { challenges: await listChallengeViews(user.id, today) });
  },
  POST: async (req, res) => {
    const user = await requireUser(req);
    const body = parseBody(req, createSchema);
    const code = normalizeFriendCode(body.friendCode);
    const opponent = code ? await findUserByFriendCode(code) : null;
    if (!opponent) throw new HttpError(404, "No user with that friend code");
    if (opponent.id === user.id) throw new HttpError(400, "You cannot challenge yourself");
    const id = await createChallenge({
      type: body.type,
      creatorId: user.id,
      opponentId: opponent.id,
      days: body.days,
      target: body.type === "first_to_target" ? body.target : null,
    });
    // `today` only affects active challenges; a new one is pending, so any valid day works.
    const [challenge] = await loadChallengeViews(user.id, new Date().toISOString().slice(0, 10), id);
    sendJson(res, 201, { challenge });
  },
});
