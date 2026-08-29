import { Suspense } from "react";

import { LoadingBlock } from "@/components/ui/feedback";
import { DoctorsListPage } from "@/features/doctors/doctors-list-page";

export default function DoctorsPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Đang mở danh sách bác sĩ..." />}>
      <DoctorsListPage />
    </Suspense>
  );
}
