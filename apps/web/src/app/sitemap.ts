import type { MetadataRoute } from "next";
import { asUser } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const statics = ["", "/discover", "/trending", "/communities", "/how-it-works", "/guidelines", "/privacy", "/terms", "/contact"].map((p) => ({ url: `${base}${p}` }));
  try {
    const [debates, comms, people] = await asUser(null, async (tx) => [
      await tx`select id, updated_at from faceoff.debate_sessions where visibility = 'public' and moderation_state = 'visible' and status in ('completed','scheduled','live') and not is_demo order by updated_at desc limit 5000`,
      await tx`select slug, updated_at from faceoff.communities where status = 'active'`,
      await tx`select username, updated_at from faceoff.profiles where visibility = 'public' and account_status = 'active' and onboarded_at is not null and not is_demo limit 5000`,
    ]);
    return [
      ...statics,
      ...comms.map((c) => ({ url: `${base}/c/${c.slug}`, lastModified: c.updated_at })),
      ...debates.map((d) => ({ url: `${base}/d/${d.id}`, lastModified: d.updated_at })),
      ...people.map((p) => ({ url: `${base}/u/${p.username}`, lastModified: p.updated_at })),
    ];
  } catch {
    return statics;
  }
}
