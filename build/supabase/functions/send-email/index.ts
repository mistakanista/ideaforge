// Sends one email (US-8). Only addresses in MAIL_REAL_RECIPIENTS really receive it;
// for everyone else the mail is only simulated (nothing is sent).
// Secrets (never in code): EMAIL, EMAIL_PASSWORD, MAIL_FUNCTION_SECRET, MAIL_REAL_RECIPIENTS.
import nodemailer from 'npm:nodemailer@6.9.16';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Tells the table email_log (US-8) what happened. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase to every Edge Function. A problem here never changes the answer.
async function report(logId: number | undefined, status: string, detail?: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!logId || !url || !key) return;
  try {
    await fetch(`${url}/rest/v1/email_log?log_id=eq.${logId}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, detail: detail ?? null }),
    });
  } catch (e) {
    console.error('Could not update email_log', e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Not an open mail relay: the caller must know the shared secret.
  const secret = Deno.env.get('MAIL_FUNCTION_SECRET');
  if (!secret || req.headers.get('x-mail-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  let input: { to?: string; subject?: string; text?: string; log_id?: number };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const to = input.to?.trim();
  if (!to || !to.includes('@') || !input.subject || !input.text) {
    return json({ error: 'to, subject and text are required' }, 400);
  }

  const realRecipients = (Deno.env.get('MAIL_REAL_RECIPIENTS') ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  if (!realRecipients.includes(to.toLowerCase())) {
    console.log(`SIMULATED mail to ${to}: ${input.subject}`);
    await report(input.log_id, 'SIMULATED');
    return json({ status: 'simulated' });
  }

  const user = Deno.env.get('EMAIL');
  const pass = Deno.env.get('EMAIL_PASSWORD');
  if (!user || !pass) {
    await report(input.log_id, 'FAILED', 'EMAIL or EMAIL_PASSWORD not set');
    return json({ error: 'EMAIL or EMAIL_PASSWORD not set' }, 500);
  }

  // Edge Functions block outgoing SMTP ports 25 and 587, so port 465 (TLS from the start) is used.
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  try {
    await transport.sendMail({ from: user, to, subject: input.subject, text: input.text });
    console.log(`SENT mail to ${to}: ${input.subject}`);
    await report(input.log_id, 'SENT');
    return json({ status: 'sent' });
  } catch (e) {
    console.error('Sending failed', e);
    await report(input.log_id, 'FAILED', String(e).slice(0, 500));
    return json({ status: 'failed', error: String(e) }, 502);
  }
});
