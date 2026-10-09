import { LogoMark } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_420px] md:py-20">
      <div className="hidden md:block">
        <LogoMark className="h-24 w-auto" title="" />
        <p className="mt-8 max-w-sm font-serif text-4xl font-semibold leading-tight">Every idea deserves a challenger.</p>
        <p className="mt-4 max-w-sm text-muted">Ten minutes. One opponent. An audience that votes on the argument, not the shouting.</p>
      </div>
      <div>{children}</div>
    </div>
  );
}
