import { DoctorAppointmentDetailPage } from "@/features/doctor/appointment-detail-page";

export default async function DoctorAppointmentDetailRoute({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;

  return <DoctorAppointmentDetailPage appointmentId={appointmentId} />;
}
