const REACHER_URL = process.env.REACHER_URL || 'http://127.0.0.1:8080/v0/check_email';
const FROM_EMAIL  = process.env.VERIFIER_FROM_EMAIL || 'verifier@inboxaxis.net';
const TIMEOUT_MS  = parseInt(process.env.REACHER_TIMEOUT_MS || '30000', 10);
const MOCK        = process.env.MOCK_REACHER === 'true';

const BIG_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com',
  'aol.com', 'protonmail.com',
]);

async function probeReal(email, ipRecord) {
  const body = {
    to_email: email,
    from_email: FROM_EMAIL,
    hello_name: ipRecord.hostname,
    proxy: { host: '127.0.0.1', port: ipRecord.socks5_port },
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(REACHER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[probe] upstream http ${res.status}:`, text.slice(0, 500));
      const bucket = res.status >= 500 ? 'probe_http_5xx' : 'probe_http_4xx';
      throw new Error(bucket);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('probe_timeout');
    throw err;
  } finally {
    clearTimeout(t);
  }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function probeMock(email, ipRecord) {
  const latency = 200 + Math.random() * 1300;
  await new Promise((r) => setTimeout(r, latency));

  const [, domain] = email.toLowerCase().split('@');

  if (BIG_PROVIDERS.has(domain)) {
    return {
      input: email,
      is_reachable: 'risky',
      misc:   { is_disposable: false, is_role_account: false },
      mx:     { accepts_mail: true, records: [`mx.${domain}`] },
      smtp:   { can_connect_smtp: false, has_full_inbox: false, is_catch_all: true, is_deliverable: false, is_disabled: true },
      syntax: { is_valid_syntax: true, domain, username: email.split('@')[0] },
      _mock:  true, _ip_used: ipRecord.ip, _via_port: ipRecord.socks5_port,
    };
  }

  const bucket = hashStr(email) % 100;
  let reach;
  if      (bucket < 65) reach = 'safe';
  else if (bucket < 80) reach = 'risky';
  else if (bucket < 95) reach = 'invalid';
  else                  reach = 'unknown';

  return {
    input: email,
    is_reachable: reach,
    misc:   { is_disposable: false, is_role_account: false },
    mx:     { accepts_mail: reach !== 'invalid', records: [`mx.${domain}`] },
    smtp: {
      can_connect_smtp: reach !== 'unknown',
      has_full_inbox: false,
      is_catch_all: reach === 'risky',
      is_deliverable: reach === 'safe',
      is_disabled: false,
    },
    syntax: { is_valid_syntax: true, domain, username: email.split('@')[0] },
    _mock: true, _ip_used: ipRecord.ip, _via_port: ipRecord.socks5_port,
  };
}

export async function probeEmail(email, ipRecord) {
  return MOCK ? probeMock(email, ipRecord) : probeReal(email, ipRecord);
}

export function classifyVerdict(r, isRoleFromPrefilter = false) {
  const reach = r?.is_reachable;
  let verdict = 'unknown';
  if (reach === 'safe')         verdict = 'valid';
  else if (reach === 'invalid') verdict = 'invalid';
  else if (reach === 'risky')   verdict = 'risky';

  const isRole = isRoleFromPrefilter || !!r?.misc?.is_role_account;
  if (verdict === 'valid' && isRole) verdict = 'risky';

  const reasons = [];
  if (isRole)                                 reasons.push('role_account');
  if (r?.misc?.is_disposable)                 reasons.push('disposable');
  if (r?.smtp?.is_disabled)                   reasons.push('smtp_disabled');
  if (r?.smtp?.is_catch_all)                  reasons.push('catch_all');
  if (r?.smtp?.has_full_inbox)                reasons.push('full_inbox');
  if (r?.smtp?.is_deliverable === false && verdict === 'invalid') reasons.push('not_deliverable');
  if (r?.mx?.accepts_mail === false)          reasons.push('mx_no_accept');
  if (r?.syntax?.is_valid_syntax === false)   reasons.push('invalid_syntax');

  return { verdict, reason: reasons.length ? reasons.join(',') : null };
}

export const isMockMode = () => MOCK;
