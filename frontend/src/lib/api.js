async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`non-json response (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || body?.message || `http_${res.status}`);
  return body;
}

export const api = {
  health() {
    return jsonFetch('/api/health');
  },

  verifySingle(email) {
    return jsonFetch('/api/verify/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  },

  bulkPeek(file) {
    const fd = new FormData();
    fd.append('file', file);
    return jsonFetch('/api/verify/bulk/peek', { method: 'POST', body: fd });
  },

  bulkSubmit(file, mapping) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('column_email', mapping.email);
    if (mapping.first_name) fd.append('column_first_name', mapping.first_name);
    if (mapping.last_name)  fd.append('column_last_name',  mapping.last_name);
    return jsonFetch('/api/verify/bulk', { method: 'POST', body: fd });
  },

  listJobs(limit = 20) {
    return jsonFetch(`/api/jobs?limit=${limit}`);
  },

  getJob(uuid) {
    return jsonFetch(`/api/jobs/${uuid}`);
  },

  getJobResults(uuid, limit = 1000, offset = 0) {
    return jsonFetch(`/api/jobs/${uuid}/results?limit=${limit}&offset=${offset}`);
  },

  resultsCsvUrl(uuid) {
    return `/api/jobs/${uuid}/results.csv`;
  },
};
