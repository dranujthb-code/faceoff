import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server/auth";
import { safeNext } from "@/lib/server/page-guards";
import { SignInForm } from "./SignInForm";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await getViewer();
  if (v) redirect(v.onboarded ? safeNext(sp.next) : "/onboarding");
  return <SignInForm next={safeNext(sp.next)} reset={sp.reset === "1"} />;
}
