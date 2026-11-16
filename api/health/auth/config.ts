import { sendJson } from "../../_lib/json.js";
import { REDIRECT_URI, workosConfig } from "../../_lib/health/auth.js";
import { HttpError, route } from "../../_lib/health/http.js";

export default route({
  GET: async (_req, res) => {
    const config = workosConfig();
    if (!config) throw new HttpError(503, "Sign-in is not configured");
    sendJson(res, 200, { clientId: config.clientId, redirectUri: REDIRECT_URI });
  },
});
