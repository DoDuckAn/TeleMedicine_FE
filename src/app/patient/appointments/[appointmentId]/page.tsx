import { AppointmentDetailPage } from "@/features/patient/appointment-detail-page";

export default async function PatientAppointmentDetailRoute({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;

  return <AppointmentDetailPage appointmentId={appointmentId} />;
}
