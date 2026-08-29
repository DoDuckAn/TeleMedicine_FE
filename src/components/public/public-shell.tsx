import {
  CalendarPlus,
  ChevronDown,
  LogIn,
  Menu,
  PhoneCall,
  Search,
} from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/doctors", label: "Chuyên gia - Bác sĩ" },
  { href: "/doctors", label: "Chuyên khoa" },
  { href: "/auth/patient", label: "Đặt hẹn khám" },
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="bg-primary text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <Link aria-label="Trang chủ" href="/">
              <BrandMark inverse />
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <PhoneCall aria-hidden="true" className="size-4" />
                <span>Đặt hẹn khám</span>
                <span className="rounded-md bg-red-500 px-2.5 py-1 text-white">
                  1900 633 465
                </span>
              </div>
              <Link
                className={cn(
                  buttonVariants({ size: "sm", variant: "soft" }),
                  "border-white/25 bg-white/10 text-white hover:bg-white/20",
                )}
                href="/auth/staff"
              >
                <LogIn aria-hidden="true" className="size-4" />
                Nhân viên
              </Link>
            </div>

            <button
              aria-label="Mở menu"
              className="flex size-10 items-center justify-center rounded-lg border border-white/25 text-white md:hidden"
              type="button"
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-800 md:flex">
            {navItems.map((item) => (
              <Link
                className="inline-flex items-center gap-1 transition hover:text-primary"
                href={item.href}
                key={item.label}
              >
                {item.label}
                {item.label !== "Trang chủ" ? (
                  <ChevronDown aria-hidden="true" className="size-3.5" />
                ) : null}
              </Link>
            ))}
          </nav>

          <Link
            className="hidden min-w-72 items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-white lg:flex"
            href="/doctors"
          >
            <Search aria-hidden="true" className="size-4" />
            Tìm bác sĩ, chuyên khoa
          </Link>

          <div className="flex flex-1 justify-end gap-2 md:flex-none">
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href="/auth/patient"
            >
              <LogIn aria-hidden="true" className="size-4" />
              Đăng nhập
            </Link>
            <Link
              className={buttonVariants({ size: "sm", variant: "success" })}
              href="/auth/patient?mode=register"
            >
              <CalendarPlus aria-hidden="true" className="size-4" />
              Đăng ký khám
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-blue-100 bg-primary text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <BrandMark inverse />
            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100">
              Nền tảng hỗ trợ bệnh nhân đặt lịch khám từ xa, nhận tư vấn video
              và theo dõi lịch hẹn cùng bác sĩ chuyên khoa.
            </p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Liên hệ</p>
            <p className="mt-3 text-blue-100">Tổng đài: 1900 633 465</p>
            <p className="mt-1 text-blue-100">Thời gian: 07:30 - 16:30</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Truy cập nhanh</p>
            <div className="mt-3 flex flex-col gap-2 text-blue-100">
              <Link href="/doctors">Danh sách bác sĩ</Link>
              <Link href="/auth/patient">Đăng nhập bệnh nhân</Link>
              <Link href="/auth/staff">Đăng nhập nhân viên</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
