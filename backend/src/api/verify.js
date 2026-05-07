import { Router } from 'express';
import multer from 'multer';
import { verifySingle } from '../services/verifier.js';
import { peekCsv, extractRows } from '../services/csvParser.js';
import { pool } from '../db/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/single', async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email_required' });
  }
  if (email.length > 320) return res.status(400).json({ error: 'email_too_long' });
  try {
    const result = await verifySingle(email);
    res.json(result);
  } catch (err) {
    console.error('[POST /verify/single]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

router.post('/bulk/peek', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });
  try {
    const peek = peekCsv(req.file.buffer);
    res.json({
      filename: req.file.originalname,
      sizeBytes: req.file.size,
      ...peek,
    });
  } catch (err) {
    console.error('[POST /verify/bulk/peek]', err);
    res.status(400).json({ error: 'csv_parse_failed', message: err.message });
  }
});

router.post('/bulk', upload.single('file'), async (req, res) => {
  if (!req.file)                   return res.status(400).json({ error: 'file_required' });
  if (!req.body?.column_email)     return res.status(400).json({ error: 'column_email_required' });

  const mapping = {
    email:      String(req.body.column_email),
    first_name: req.body.column_first_name ? String(req.body.column_first_name) : null,
    last_name:  req.body.column_last_name  ? String(req.body.column_last_name)  : null,
  };

  let rows;
  try {
    rows = extractRows(req.file.buffer, mapping);
  } catch (err) {
    return res.status(400).json({ error: 'csv_parse_failed', message: err.message });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: 'no_emails_in_column', column: mapping.email });
  }

  const emails     = rows.map((r) => r.email);
  const firstNames = rows.map((r) => r.first_name);
  const lastNames  = rows.map((r) => r.last_name);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: jobRows } = await client.query(
      `INSERT INTO bulk_jobs (original_filename, total_count, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, job_uuid, total_count, status, uploaded_at`,
      [req.file.originalname, rows.length]
    );
    const job = jobRows[0];

    await client.query(
      `INSERT INTO verifications (email, first_name, last_name, bulk_job_id, status)
       SELECT email, first_name, last_name, $4, 'pending'
       FROM unnest($1::text[], $2::text[], $3::text[])
            AS t(email, first_name, last_name)`,
      [emails, firstNames, lastNames, job.id]
    );

    await client.query('COMMIT');
    res.json({
      jobUuid: job.job_uuid,
      jobId: Number(job.id),
      totalCount: rows.length,
      status: job.status,
      uploadedAt: job.uploaded_at,
      filename: req.file.originalname,
      mapping,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /verify/bulk]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  } finally {
    client.release();
  }
});

export default router;
