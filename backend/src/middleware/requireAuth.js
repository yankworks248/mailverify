import jwt from "jsonwebtoken";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    "SESSION_SECRET env var must be set and at least 32 characters long",
  );
}

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
