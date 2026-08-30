import { PatientReviewPage } from "@/features/patient/review-page";

export default async function PatientReviewRoute({
  params,
}: {
  params: Promise<{ doctorId: string }>;
}) {
  const { doctorId } = await params;

  return <PatientReviewPage doctorId={doctorId} />;
}
