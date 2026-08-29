/* eslint-disable @next/next/no-img-element */
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

type DoctorAvatarProps = {
  alt: string;
  className?: string;
  src?: string | null;
};

export function DoctorAvatar({ alt, className, src }: DoctorAvatarProps) {
  if (src) {
    return (
      <img
        alt={alt}
        className={cn("h-full w-full object-cover", className)}
        loading="lazy"
        src={src}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-100 via-white to-blue-200 text-primary",
        className,
      )}
    >
      <UserRound aria-hidden="true" className="size-16" />
    </div>
  );
}
