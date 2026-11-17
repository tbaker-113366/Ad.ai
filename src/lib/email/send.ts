import "server-only";
import { EMAIL_FROM } from "@/lib/config";

/** Send one email through Resend (REST). Returns false, and logs why, if it couldn't. */
export async function sendEmail(msg: { to: string[]; subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("email not sent: RESEND_API_KEY is not set");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  if (!res.ok) {
    console.error("email not sent", { status: res.status, body: (await res.text()).slice(0, 300) });
    return false;
  }
  return true;
}
