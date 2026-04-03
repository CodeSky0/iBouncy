import { ok, methodNotAllowed, serverError } from "../_lib/response.js";
import { getUserFromRequest } from "../_lib/auth.js";

export default async function handler(req: any, res: any) {
    if (req.method !== "GET") return methodNotAllowed(res, "GET");
    try {
        const user = getUserFromRequest(req);
        return ok(res, { user: user ? { id: user.userId, email: user.email } : null });
    } catch (e) {
        return serverError(res, e);
    }
}

