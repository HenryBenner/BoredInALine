import { config } from '../config/env';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — email not sent. Would send to:', options.to, '| Subject:', options.subject);
    return false;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Bored in a Line <onboarding@resend.dev>';

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('Resend email error:', error);
      return false;
    }

    console.log('Email sent to:', options.to);
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}

export function getPasswordResetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Bored in a Line</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:0 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#DC143C;font-size:28px;margin:0;">Bored in a Line</h1>
    </div>
    <div style="background:#1C1C1C;border-radius:16px;padding:32px;">
      <h2 style="color:#FFFFFF;font-size:20px;margin:0 0 12px;">Reset Your Password</h2>
      <p style="color:#9CA3AF;font-size:15px;line-height:1.6;margin:0 0 24px;">
        We received a request to reset your password. Tap the button below to choose a new one. This link expires in 1 hour.
      </p>
      <a href="${resetUrl}" style="display:block;background:#DC143C;color:#FFFFFF;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-size:16px;font-weight:600;">
        Reset Password
      </a>
      <p style="color:#666;font-size:13px;margin:20px 0 0;text-align:center;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <p style="color:#444;font-size:12px;text-align:center;margin-top:24px;">
      Bored in a Line &bull; <a href="mailto:support@boredinaline.com" style="color:#666;">support@boredinaline.com</a>
    </p>
  </div>
</body>
</html>`;
}
