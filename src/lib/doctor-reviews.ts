import type { DoctorReview } from "@/types/api";

export function getDoctorReviewReply(
  review: Pick<DoctorReview, "doctorReply">,
) {
  if (!review.doctorReply) {
    return null;
  }

  if (typeof review.doctorReply === "string") {
    return review.doctorReply;
  }

  return review.doctorReply.content;
}
