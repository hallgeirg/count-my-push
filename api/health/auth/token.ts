import { z } from "zod";
import { sendJson } from "../../_lib/json.js";
import { exchangeCode } from "../../_lib/health/auth.js";
import { parseBody, route } from "../../_lib/health/http.js";

const schema = z.object({
  code: z.string().min(1).max(2000),
  codeVerifier: z.string().min(1).max(2000),
});

export default route({
  POST: async (req, res) => {
    const { code, codeVerifier } = parseBody(req, schema);
    sendJson(res, 200, await exchangeCode(code, codeVerifier));
  },
});
