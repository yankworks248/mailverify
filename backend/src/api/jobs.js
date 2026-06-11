import { Router } from "express";
import { stringify } from "csv-stringify/sync";
import { pool } from "../db/index.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const { rows } = await pool.query(
      `SELECT id, job_uuid, original_filename, total_count, processed_count,
              valid_count, invalid_count, risky_count, unknown_count,
              status, uploaded_at, started_at, completed_at, error
       FROM bulk_jobs
       ORDER BY uploaded_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json(rows.map(formatJob));
  } catch (err) {
    console.error("[GET /jobs]", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/:uuid", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, job_uuid, original_filename, total_count, processed_count,
              valid_count, invalid_count, risky_count, unknown_count,
              status, uploaded_at, started_at, completed_at, error
       FROM bulk_jobs WHERE job_uuid = $1`,
      [req.params.uuid],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "job_not_found" });
    res.json(formatJob(rows[0]));
  } catch (err) {
    console.error("[GET /jobs/:uuid]", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/:uuid/results", async (req, res) => {
  try {
    const { rows: jobRows } = await pool.query(
      `SELECT id FROM bulk_jobs WHERE job_uuid = $1`,
      [req.params.uuid],
    );
    if (jobRows.length === 0)
      return res.status(404).json({ error: "job_not_found" });

    const limit = Math.min(parseInt(req.query.limit || "1000", 10), 5000);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const { rows } = await pool.query(
      `SELECT first_name, last_name, email, verdict, reason,
       duration_ms, verified_at
       FROM verifications
       WHERE bulk_job_id = $1
       ORDER BY id
       LIMIT $2 OFFSET $3`,
      [jobRows[0].id, limit, offset],
    );

    res.json({
      jobUuid: req.params.uuid,
      limit,
      offset,
      results: rows.map((r) => ({
        id: Number(r.id),
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        verdict: r.verdict,
        reason: r.reason,
        ip_used: r.ip_used,
        duration_ms: r.duration_ms,
        status: r.status,
        verified_at: r.verified_at,
      })),
    });
  } catch (err) {
    console.error("[GET /jobs/:uuid/results]", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/:uuid/results.csv", async (req, res) => {
  try {
    const { rows: jobRows } = await pool.query(
      `SELECT id, original_filename FROM bulk_jobs WHERE job_uuid = $1`,
      [req.params.uuid],
    );
    if (jobRows.length === 0) return res.status(404).send("job_not_found");

    const job = jobRows[0];

    const ALLOWED_VERDICTS = ["valid", "invalid", "risky", "unknown"];
    const verdict = String(req.query.verdict || "").toLowerCase();
    const filterByVerdict = ALLOWED_VERDICTS.includes(verdict);

    const params = [job.id];
    let whereClause = "WHERE bulk_job_id = $1";
    if (filterByVerdict) {
      params.push(verdict);
      whereClause += " AND verdict = $2";
    }

    const { rows } = await pool.query(
      `SELECT first_name, last_name, email, verdict, reason,
              host(ip_used)::text AS ip_used, duration_ms, verified_at
       FROM verifications
       ${whereClause}
       ORDER BY id`,
      params,
    );

    const csv = stringify(rows, {
      header: true,
      columns: [
        "first_name",
        "last_name",
        "email",
        "verdict",
        "reason",
        "duration_ms",
        "verified_at",
      ],
    });

    const safeName = (job.original_filename || `job-${req.params.uuid}`)
      .replace(/\.csv$/i, "")
      .replace(/[^A-Za-z0-9_.-]+/g, "_");

    const suffix = filterByVerdict ? verdict : "verified";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}_${suffix}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    console.error("[GET results.csv]", err);
    res.status(500).send("internal_error");
  }
});

function formatJob(r) {
  const total = Number(r.total_count);
  const processed = Number(r.processed_count);
  return {
    id: Number(r.id),
    jobUuid: r.job_uuid,
    filename: r.original_filename,
    status: r.status,
    totalCount: total,
    processedCount: processed,
    validCount: Number(r.valid_count),
    invalidCount: Number(r.invalid_count),
    riskyCount: Number(r.risky_count),
    unknownCount: Number(r.unknown_count),
    progressPct: total > 0 ? Math.round((processed / total) * 100) : 0,
    uploadedAt: r.uploaded_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    error: r.error,
  };
}

export default router;
