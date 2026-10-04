import { env } from '../config/env.js';

export async function deliverEmail({ to, subject, text }) {
  if (!env.emailApiUrl || !env.emailApiKey) {
    return { delivered: false, reason: 'not_configured' };
  }
  let response;
  try {
    response = await fetch(env.emailApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.emailApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, text }),
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    return { delivered: false, reason: 'provider_unavailable' };
  }
  if (!response.ok) return { delivered: false, reason: 'provider_rejected' };
  return { delivered: true };
}
