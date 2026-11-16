import { z } from "zod";
import { sendJson } from "../../_lib/json.js";
import { refreshTokens } from "../../_lib/health/auth.js";
import { parseBody, route } from "../../_lib/health/http.js";

const schema = z.object({ refreshToken: z.string().min(1).max(4000) });

export default route({
  POST: async (req, res) => {
    const { refreshToken } = parseBody(req, schema);
    sendJson(res, 200, await refreshTokens(refreshToken));
  },
});
