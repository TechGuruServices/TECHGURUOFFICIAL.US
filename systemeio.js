/**
 * Systeme.io CRM Integration
 * ---------------------------------------------------------------
 * Adds (or finds) a contact in Systeme.io and applies a tag when
 * someone submits the lead magnet or the contact form. Tags are
 * what trigger Systeme.io automations on your end — e.g. tagging
 * a contact "Lead Magnet - Website Checklist" can kick off a rule
 * that emails them the checklist PDF and starts a nurture sequence.
 *
 * This module never throws out of the main request flow — if
 * Systeme.io is unreachable, misconfigured, or the API key isn't
 * set yet, it logs a warning and the rest of the form submission
 * (Web3Forms email + Telegram notification) still succeeds.
 *
 * Environment variable required:
 * - SYSTEME_API_KEY: Public API key from systeme.io
 *   (Settings > MCP & API keys > Public API keys > Create)
 *
 * Docs: https://developer.systeme.io/reference
 */

const SYSTEME_BASE = 'https://api.systeme.io/api';

const systemeHeaders = (apiKey) => ({
  'Content-Type': 'application/json',
  'X-API-Key': apiKey,
});

/**
 * Look up an existing contact by email.
 */
const findContactByEmail = async (email, apiKey) => {
  const res = await fetch(`${SYSTEME_BASE}/contacts?email=${encodeURIComponent(email)}`, {
    headers: systemeHeaders(apiKey),
  });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const items = data?.items || data?.data || (Array.isArray(data) ? data : []);
  return items?.[0] || null;
};

/**
 * Create a contact. If it already exists (Systeme.io returns a
 * 422/409 for a duplicate email), fall back to looking it up
 * instead of treating that as a failure.
 */
const upsertContact = async (email, apiKey, extra = {}) => {
  const createRes = await fetch(`${SYSTEME_BASE}/contacts`, {
    method: 'POST',
    headers: systemeHeaders(apiKey),
    body: JSON.stringify({ email, locale: 'en', ...extra }),
  });

  if (createRes.ok) {
    return await createRes.json();
  }

  const existing = await findContactByEmail(email, apiKey);
  if (existing) return existing;

  const errText = await createRes.text().catch(() => '');
  throw new Error(`Systeme.io contact create failed (${createRes.status}): ${errText}`);
};

/**
 * Find a tag by exact name (case-insensitive), creating it if it
 * doesn't exist yet. Keeps tag names consistent even if you
 * haven't pre-created them in the Systeme.io dashboard.
 */
const findOrCreateTag = async (tagName, apiKey) => {
  const listRes = await fetch(`${SYSTEME_BASE}/tags?limit=100`, { headers: systemeHeaders(apiKey) });
  if (listRes.ok) {
    const data = await listRes.json().catch(() => null);
    const items = data?.items || data?.data || (Array.isArray(data) ? data : []);
    const match = items?.find((t) => t?.name?.toLowerCase() === tagName.toLowerCase());
    if (match) return match;
  }

  const createRes = await fetch(`${SYSTEME_BASE}/tags`, {
    method: 'POST',
    headers: systemeHeaders(apiKey),
    body: JSON.stringify({ name: tagName }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`Systeme.io tag create failed (${createRes.status}): ${errText}`);
  }

  return await createRes.json();
};

/**
 * Assign a tag to a contact by id. A 422 here usually just means
 * "already tagged" — treat that as success, not an error.
 */
const assignTag = async (contactId, tagId, apiKey) => {
  const res = await fetch(`${SYSTEME_BASE}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: systemeHeaders(apiKey),
    body: JSON.stringify({ tagId }),
  });

  if (!res.ok && res.status !== 422) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Systeme.io tag assign failed (${res.status}): ${errText}`);
  }
};

/**
 * Main entry point — call this from subscribe.js / contact.js
 * inside a ctx.waitUntil() so it never delays the response the
 * visitor sees.
 *
 * @param {object} env - Worker environment bindings
 * @param {object} opts
 * @param {string} opts.email - required
 * @param {string} [opts.tagName] - e.g. "Lead Magnet - Website Checklist"
 * @param {string} [opts.firstName]
 */
export const syncToSystemeIo = async (env, { email, tagName, firstName }) => {
  const apiKey = env.SYSTEME_API_KEY;
  if (!apiKey) {
    console.warn('SYSTEME_API_KEY not configured — skipping Systeme.io sync');
    return { success: false, skipped: true };
  }

  try {
    const extra = firstName ? { firstName } : {};
    const contact = await upsertContact(email, apiKey, extra);
    const contactId = contact?.id ?? contact?.data?.id;
    if (!contactId) throw new Error('No contact id returned from Systeme.io');

    if (tagName) {
      const tag = await findOrCreateTag(tagName, apiKey);
      const tagId = tag?.id ?? tag?.data?.id;
      if (tagId) await assignTag(contactId, tagId, apiKey);
    }

    return { success: true, contactId };
  } catch (error) {
    console.error('Systeme.io Sync Error:', error);
    return { success: false, error: error.message };
  }
};
