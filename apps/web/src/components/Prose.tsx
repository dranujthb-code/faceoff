import type { ReactNode } from "react";

export function Prose({ title, intro, children, updated, draft }: { title: string; intro?: ReactNode; children: ReactNode; updated?: string; draft?: boolean }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {updated && <p className="mt-2 text-sm text-muted">Last updated {updated}</p>}
      {draft && (
        <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Draft for legal review. This text is a working placeholder and must be reviewed by qualified counsel for each launch market before FaceOff opens to the public.
        </p>
      )}
      {intro && <p className="mt-5 text-lg text-muted">{intro}</p>}
      <div className="prose-fo mt-8 space-y-6 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p]:leading-relaxed [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
