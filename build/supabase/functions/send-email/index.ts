// Sends one email (US-8). Only addresses in MAIL_REAL_RECIPIENTS really receive it;
// for everyone else the mail is only simulated (nothing is sent).
// Secrets (never in code): EMAIL, EMAIL_PASSWORD, MAIL_FUNCTION_SECRET, MAIL_REAL_RECIPIENTS.
import nodemailer from 'npm:nodemailer@6.9.16';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Not an open mail relay: the caller must know the shared secret.
  const secret = Deno.env.get('MAIL_FUNCTION_SECRET');
  if (!secret || req.headers.get('x-mail-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  let input: { to?: string; subject?: string; text?: string };
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
    return json({ status: 'simulated' });
  }

  const user = Deno.env.get('EMAIL');
  const pass = Deno.env.get('EMAIL_PASSWORD');
  if (!user || !pass) return json({ error: 'EMAIL or EMAIL_PASSWORD not set' }, 500);

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
    return json({ status: 'sent' });
  } catch (e) {
    console.error('Sending failed', e);
    return json({ status: 'failed', error: String(e) }, 502);
  }
});
