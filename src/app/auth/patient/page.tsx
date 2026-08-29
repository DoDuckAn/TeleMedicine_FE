import { Suspense } from "react";

import { LoadingBlock } from "@/components/ui/feedback";
import { PatientAuthPage } from "@/features/auth/patient-auth-page";

export default function PatientAuthRoute() {
  return (
    <Suspense
      fallback={<LoadingBlock label="Đang mở đăng nhập bệnh nhân..." />}
    >
      <PatientAuthPage />
    </Suspense>
  );
}
