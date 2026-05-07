import jwt from "jsonwebtoken";

const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-prod";

export function requireAuth(req, res, next) {
  const token = req.cookies?.mv_session;
  if (!token) return res.status(401).json({ error: "not_authenticated" });
  try {
    req.user = jwt.verify(token, SESSION_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_session" });
  }
}
