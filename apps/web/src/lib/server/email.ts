import "server-only";
import { asService } from "./db";
import { env } from "./env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailResult = { delivered: boolean; driver: "dev" | "resend"; error?: string };

/** Sends email via Resend (production) or captures it in the dev outbox (development only). */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  if (env.EMAIL_DRIVER === "resend") {
    if (!env.RESEND_API_KEY) return { delivered: false, driver: "resend", error: "RESEND_API_KEY missing" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { delivered: false, driver: "resend", error: `HTTP ${res.status}` };
      return { delivered: true, driver: "resend" };
    } catch (e) {
      return { delivered: false, driver: "resend", error: (e as Error).message };
    }
  }
  if (env.APP_ENV === "production") return { delivered: false, driver: "dev", error: "dev driver disabled in production" };
  await asService(
    (tx) => tx`insert into faceoff.dev_outbox (to_email, subject, text_body, html_body)
               values (${msg.to}, ${msg.subject}, ${msg.text}, ${msg.html ?? null})`,
  );
  return { delivered: true, driver: "dev" };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#FBF7EF;font-family:Inter,Arial,sans-serif;color:#0B1419">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #E4DBCB;border-radius:16px">
<tr><td style="padding:28px 28px 8px"><span style="font-family:Georgia,serif;font-weight:700;font-size:22px">Face<span style="color:#C93B35">Off</span></span>
<div style="font-size:11px;letter-spacing:.12em;color:#525C63;margin-top:2px">YOU HAVE A VOICE</div></td></tr>
<tr><td style="padding:12px 28px 28px"><h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${esc(title)}</h1>
${bodyHtml}
${cta ? `<p style="margin:24px 0 8px"><a href="${esc(cta.url)}" style="background:#C93B35;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>
<p style="font-size:12px;color:#525C63;word-break:break-all">Or paste this link: ${esc(cta.url)}</p>` : ""}
</td></tr></table>
<p style="font-size:11px;color:#868E93;margin-top:16px">You received this because of activity on your FaceOff account.</p>
</td></tr></table></body></html>`;
}

export const emails = {
  verify(to: string, url: string): EmailMessage {
    return {
      to,
      subject: "Confirm your FaceOff email",
      text: `Welcome to FaceOff. Confirm your email to start debating:\n\n${url}\n\nThis link expires in 24 hours.`,
      html: layout("Confirm your email", `<p>Welcome to FaceOff. Confirm your email address to start sending challenges.</p><p style="color:#525C63;font-size:13px">This link expires in 24 hours.</p>`, { label: "Confirm email", url }),
    };
  },
  reset(to: string, url: string): EmailMessage {
    return {
      to,
      subject: "Reset your FaceOff password",
      text: `Someone (hopefully you) asked to reset your FaceOff password. Use this link within 1 hour:\n\n${url}\n\nIf this wasn't you, ignore this email.`,
      html: layout("Reset your password", `<p>Use the button below within 1 hour to choose a new password. If you didn't ask for this, you can ignore this email.</p>`, { label: "Choose a new password", url }),
    };
  },
  notification(to: string, title: string, body: string, url: string): EmailMessage {
    return {
      to,
      subject: title,
      text: `${title}\n\n${body}\n\n${url}`,
      html: layout(title, `<p>${esc(body)}</p>`, { label: "Open FaceOff", url }),
    };
  },
};
