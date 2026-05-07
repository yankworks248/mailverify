import validator from 'validator';
import dns from 'dns/promises';

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'throwaway.email', 'temp-mail.org', 'yopmail.com', 'sharklasers.com',
  'getnada.com', 'maildrop.cc', 'mailnesia.com', 'trashmail.com',
  'fakeinbox.com', 'tempr.email', 'dispostable.com', 'mintemail.com',
  'spamgourmet.com', 'mohmal.com', 'tempinbox.com', 'mailcatch.com',
]);

const ROLE_LOCALPARTS = new Set([
  'info', 'admin', 'support', 'contact', 'sales', 'help',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'postmaster', 'webmaster', 'hostmaster', 'abuse',
  'hello', 'team', 'office', 'enquiry', 'enquiries',
  'marketing', 'feedback', 'press', 'media', 'careers', 'jobs',
  'billing', 'accounts', 'finance', 'legal', 'hr',
]);

const MOCK = process.env.MOCK_REACHER === 'true';

export async function preFilter(emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();

  if (!email || !validator.isEmail(email)) {
    return { skip: true, verdict: 'invalid', reason: 'invalid_syntax' };
  }

  const atIdx = email.lastIndexOf('@');
  const localPart = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { skip: true, verdict: 'invalid', reason: 'disposable_domain' };
  }

  if (!MOCK) {
    try {
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) {
        return { skip: true, verdict: 'invalid', reason: 'no_mx' };
      }
    } catch (err) {
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'NXDOMAIN') {
        return { skip: true, verdict: 'invalid', reason: 'no_mx' };
      }
    }
  }

  return { skip: false, isRole: ROLE_LOCALPARTS.has(localPart), domain };
}
