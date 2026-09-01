import { AdminDoctorDetailPage } from "@/features/admin/doctor-detail-page";

export default async function AdminDoctorDetailRoute({
  params,
}: {
  params: Promise<{ doctorId: string }>;
}) {
  const { doctorId } = await params;

  return <AdminDoctorDetailPage doctorId={doctorId} />;
}
