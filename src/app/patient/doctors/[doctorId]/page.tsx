import {DoctorDetailPage} from "@/features/doctors/doctor-detail-page";

export default async function Page({params}: {params: Promise<{doctorId: string}>}) {
  const {doctorId}=await params;
  return <DoctorDetailPage doctorId={doctorId} patient />;
}
