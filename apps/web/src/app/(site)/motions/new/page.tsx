import { requireViewer } from "@/lib/server/page-guards";
import { NewMotion } from "./NewMotion";

export const metadata = { title: "Post a motion" };

export default async function NewMotionPage() {
  const v = await requireViewer("/motions/new");
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Post a motion</h1>
      <p className="mt-2 text-muted">A motion is a proposition you&apos;re willing to defend. It appears on your Wall, and anyone who disagrees can challenge you to a FaceOff on it.</p>
      <div className="mt-6"><NewMotion username={v.username!} /></div>
    </div>
  );
}
