import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server/auth";
import { safeNext } from "@/lib/server/page-guards";
import { SignUpForm } from "./SignUpForm";

export const metadata = { title: "Create your Wall" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await getViewer();
  if (v) redirect(v.onboarded ? safeNext(sp.next) : "/onboarding");
  return <SignUpForm next={safeNext(sp.next, "/onboarding")} />;
}
