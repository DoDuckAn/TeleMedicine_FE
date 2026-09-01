import { AdminPatientDetailPage } from "@/features/admin/patient-detail-page";

export default async function AdminPatientDetailRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return <AdminPatientDetailPage userId={userId} />;
}
