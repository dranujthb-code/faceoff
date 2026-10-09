import { redirect } from "next/navigation";
import { requireViewer, safeNext } from "@/lib/server/page-guards";
import { listCommunities, listTopics } from "@/lib/server/domain/communities";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Set up your Wall" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer("/onboarding", { onboarded: false });
  if (v.onboarded) redirect(safeNext(sp.next));
  const [topics, communities] = await Promise.all([listTopics(), listCommunities(null, { limit: 100 })]);
  return <Onboarding topics={topics} communities={communities} next={safeNext(sp.next)} emailVerified={v.emailVerified} email={v.email} />;
}
