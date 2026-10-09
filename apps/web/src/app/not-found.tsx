import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-serif text-6xl font-bold">404</p>
      <p className="mt-4 text-muted">This page doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 inline-block text-link underline">Go to FaceOff</Link>
    </main>
  );
}
