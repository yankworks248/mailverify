import { Router } from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-prod";
const SESSION_DAYS = 30;
const IS_PROD = process.env.NODE_ENV === "production";

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "credentials_required" });
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "invalid_credentials" });
  }
  const token = jwt.sign({ username }, SESSION_SECRET, {
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie("mv_session", token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({ ok: true, username });
});

router.post("/logout", (req, res) => {
  res.clearCookie("mv_session", { path: "/" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ username: req.user.username });
});

export default router;
