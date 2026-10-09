import { requireViewer } from "@/lib/server/page-guards";
import { savedAndHistory } from "@/lib/server/domain/profile-extras";
import { getDebateCard } from "@/lib/server/domain/debates";
import { DebateCard } from "@/components/DebateCard";
import { EmptyState, SectionHeading } from "@/components/ui";

export const metadata = { title: "Saved and history" };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const v = await requireViewer("/saved");
  const { saved, history } = await savedAndHistory(v.userId);
  const cards = async (ids: string[]) => (await Promise.all(ids.map((id) => getDebateCard(id, v.userId)))).filter((x) => x !== null);
  const [savedCards, historyCards] = await Promise.all([cards(saved), cards(history.map((h) => h.session_id))]);
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-8 sm:px-6">
      <section>
        <SectionHeading title="Saved debates" />
        {savedCards.length ? <div className="grid gap-4 sm:grid-cols-2">{savedCards.map((d) => <DebateCard key={d.id} d={d} compact />)}</div> : <EmptyState title="Nothing saved yet" body="Use Save on any debate to keep it here." />}
      </section>
      <section>
        <SectionHeading title="Recently watched" />
        {historyCards.length ? <div className="grid gap-4 sm:grid-cols-2">{historyCards.map((d) => <DebateCard key={d.id} d={d} compact />)}</div> : <EmptyState title="No viewing history" body="Debates you watch show up here." />}
      </section>
    </div>
  );
}
