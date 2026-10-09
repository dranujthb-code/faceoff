import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-serif text-6xl font-bold">404</p>
      <h1 className="mt-4 font-serif text-2xl font-semibold">Nothing to debate here</h1>
      <p className="mt-2 text-muted">This page doesn&apos;t exist, or it isn&apos;t visible to you.</p>
      <div className="mt-6 flex justify-center gap-2"><ButtonLink href="/discover" variant="secondary">Discover debates</ButtonLink><ButtonLink href="/">Go home</ButtonLink></div>
    </div>
  );
}
