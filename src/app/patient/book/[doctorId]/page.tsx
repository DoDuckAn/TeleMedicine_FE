import { BookingPage } from "@/features/patient/booking-page";

export default async function PatientBookRoute({
  params,
}: {
  params: Promise<{ doctorId: string }>;
}) {
  const { doctorId } = await params;

  return <BookingPage doctorId={doctorId} />;
}
