import { notFound } from "next/navigation";
import { asService } from "@/lib/server/db";
import { env, features } from "@/lib/server/env";
import { getViewer, isStaff } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev mailbox", robots: { index: false } };

/** Development only: shows emails captured by EMAIL_DRIVER=dev. Returns 404 in production. */
export default async function DevMailbox() {
  if (!features.devMailbox) notFound();
  // Outside local development (e.g. staging), captured emails contain sign-in links: staff only.
  if (env.APP_ENV !== "development" && env.APP_ENV !== "test" && !isStaff(await getViewer())) notFound();
  const mails = await asService((tx) => tx`select * from faceoff.dev_outbox order by created_at desc limit 40`);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Dev mailbox</h1>
      <p className="mt-1 text-sm text-muted">Emails captured because EMAIL_DRIVER=dev. Visible to admins on staging; never available in production.</p>
      <ul className="mt-6 space-y-3">
        {mails.map((m) => (
          <li key={m.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="font-semibold">{m.subject}</p>
            <p className="text-xs text-muted">to {m.to_email} — {m.created_at.toISOString()}</p>
            <p className="mt-2 whitespace-pre-wrap break-words">
              {String(m.text_body).split(/(https?:\/\/\S+)/g).map((part: string, i: number) =>
                /^https?:\/\//.test(part) ? <a key={i} href={part} className="text-link underline">{part}</a> : part,
              )}
            </p>
          </li>
        ))}
        {mails.length === 0 && <li className="text-muted">No emails yet.</li>}
      </ul>
    </div>
  );
}
