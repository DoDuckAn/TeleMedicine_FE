import { PhoneCall } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

type AuthShellProps = {
  children: React.ReactNode;
  description: string;
  title: string;
};

export function AuthShell({ children, description, title }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-primary p-8 text-white lg:block">
        <Image
          alt="Không gian tư vấn khám bệnh từ xa"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          fill
          priority
          src="/images/telemedicine-hero.png"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/85 via-primary/92 to-blue-500/70" />
        <div className="relative flex min-h-full flex-col">
          <Link href="/">
            <BrandMark inverse />
          </Link>

          <div className="my-auto max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-md bg-red-500 px-3 py-2 text-sm font-bold text-white">
              <PhoneCall aria-hidden="true" className="size-4" />
              Tổng đài tư vấn: 1900 633 465
            </span>
            <h1 className="mt-8 text-5xl font-bold leading-tight">{title}</h1>
            <p className="mt-5 text-lg leading-8 text-blue-50">{description}</p>
          </div>

        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          <Link className="mb-8 inline-flex lg:hidden" href="/">
            <BrandMark />
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
