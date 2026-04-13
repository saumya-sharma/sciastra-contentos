import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_build_key');

export async function sendNotification({
  to,
  subject,
  title,
  body,
  ctaText,
  ctaUrl
}: {
  to: string | string[];
  subject: string;
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width">
    </head>
    <body style="margin:0;padding:0;background:#f5f4f0;
      font-family:'Helvetica Neue',Arial,sans-serif">
      <div style="max-width:560px;margin:40px auto;
        background:#fff;border-radius:12px;
        overflow:hidden;border:1px solid #e8e4da">
        
        <div style="background:#0a0a08;padding:24px 32px;
          display:flex;align-items:center;gap:10px">
          <span style="width:10px;height:10px;
            border-radius:50%;background:#e8a020;
            display:inline-block"></span>
          <span style="color:#f5f4f0;font-size:18px;
            font-weight:700;letter-spacing:-0.02em">
            Lume
          </span>
        </div>
        
        <div style="padding:32px">
          <h2 style="margin:0 0 12px;color:#0a0a08;
            font-size:20px;font-weight:600;
            letter-spacing:-0.02em">${title}</h2>
          <p style="margin:0 0 24px;color:#6b6b5a;
            font-size:15px;line-height:1.6">${body}</p>
          ${ctaText && ctaUrl ? `
          <a href="${ctaUrl}" 
            style="display:inline-block;
            background:#e8a020;color:#fff;
            padding:12px 24px;border-radius:7px;
            font-size:14px;font-weight:600;
            text-decoration:none">
            ${ctaText} →
          </a>` : ''}
        </div>
        
        <div style="padding:20px 32px;
          border-top:1px solid #e8e4da;
          background:#f9f8f5">
          <p style="margin:0;color:#b8b8a8;
            font-size:12px">
            Sent by Lume · 
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.getlume.com'}" 
              style="color:#b8b8a8">
              getlume.com
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      // TODO: Switch to noreply@getlume.com 
      // after verifying domain in Resend dashboard
      from: 'Lume <onboarding@resend.dev>',
      to,
      subject,
      html
    });
    
    if (error) {
        console.error('[notify] Resend API internally errored:', error);
    }
  } catch (e) {
    console.error('[notify] Email failed:', e);
  }
}
