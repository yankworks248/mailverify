import { parse } from 'csv-parse/sync';
import validator from 'validator';

const FIRST_NAME_HINTS = ['first_name', 'firstname', 'first name', 'fname', 'given name', 'givenname', 'first'];
const LAST_NAME_HINTS  = ['last_name', 'lastname', 'last name', 'lname', 'surname', 'family name', 'familyname', 'last'];
const EMAIL_HINTS      = ['email', 'email_address', 'emailaddress', 'e-mail', 'mail'];

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function bestHeaderMatch(headers, hints) {
  const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));
  for (const hint of hints) {
    const hintNorm = normalizeHeader(hint);
    const exact = normalized.find((n) => n.norm === hintNorm);
    if (exact) return exact.original;
  }
  for (const hint of hints) {
    const hintNorm = normalizeHeader(hint);
    const partial = normalized.find((n) => n.norm.includes(hintNorm));
    if (partial) return partial.original;
  }
  return null;
}

export function peekCsv(buffer, maxPreviewRows = 5) {
  const text = buffer.toString('utf8');
  const records = parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    to: 200,
  });

  if (records.length === 0) {
    return { headers: [], preview: [], suggested: { email: null, first_name: null, last_name: null }, sampleSize: 0 };
  }

  const headers = Object.keys(records[0]);
  const preview = records.slice(0, maxPreviewRows);

  let bestEmail = { col: null, score: 0 };
  for (const col of headers) {
    let hits = 0, total = 0;
    for (const row of records) {
      const v = String(row[col] ?? '').trim();
      if (!v) continue;
      total++;
      if (validator.isEmail(v)) hits++;
    }
    if (total === 0) continue;
    const ratio = hits / total;
    if (ratio > bestEmail.score) bestEmail = { col, score: ratio };
  }

  const emailCol = bestEmail.score > 0.5
    ? bestEmail.col
    : bestHeaderMatch(headers, EMAIL_HINTS);

  return {
    headers,
    preview,
    suggested: {
      email:      emailCol,
      first_name: bestHeaderMatch(headers, FIRST_NAME_HINTS),
      last_name:  bestHeaderMatch(headers, LAST_NAME_HINTS),
    },
    sampleSize: records.length,
  };
}

export function extractRows(buffer, mapping) {
  const text = buffer.toString('utf8');
  const records = parse(text, {
    columns: true, bom: true, skip_empty_lines: true,
    trim: true, relax_quotes: true, relax_column_count: true,
  });

  const seen = new Set();
  const out = [];
  for (const row of records) {
    const email = String(row[mapping.email] ?? '').trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    const firstName = mapping.first_name ? String(row[mapping.first_name] ?? '').trim() || null : null;
    const lastName  = mapping.last_name  ? String(row[mapping.last_name]  ?? '').trim() || null : null;

    out.push({ email, first_name: firstName, last_name: lastName });
  }
  return out;
}
