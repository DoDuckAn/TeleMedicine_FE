"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Send, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PatientShell } from "@/components/patient/patient-shell";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { getDoctor } from "@/lib/api/public";
import { createDoctorReview, getReviewEligibility } from "@/lib/api/patient";
import { useAuthStore } from "@/lib/auth/session-store";

const reviewSchema = z.object({
  comment: z.string().max(1000, "Nhận xét tối đa 1000 ký tự").optional(),
  rating: z.coerce.number().min(1).max(5),
});

type ReviewFormInput = z.input<typeof reviewSchema>;
type ReviewFormOutput = z.output<typeof reviewSchema>;

export function PatientReviewPage({ doctorId }: { doctorId: string }) {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const enabled = Boolean(accessToken && doctorId);

  const doctorQuery = useQuery({
    enabled: Boolean(doctorId),
    queryFn: () => getDoctor(doctorId),
    queryKey: ["public", "doctor", doctorId],
  });

  const eligibilityQuery = useQuery({
    enabled,
    queryFn: () => getReviewEligibility(doctorId, auth),
    queryKey: ["patient", "review-eligibility", doctorId],
  });

  const form = useForm<ReviewFormInput, unknown, ReviewFormOutput>({
    defaultValues: {
      comment: "",
      rating: 5,
    },
    resolver: zodResolver(reviewSchema),
  });

  const reviewMutation = useMutation({
    mutationFn: (values: ReviewFormOutput) =>
      createDoctorReview(
        doctorId,
        {
          comment: values.comment?.trim() || null,
          rating: values.rating,
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error("Không gửi được đánh giá.");
    },
    onSuccess: () => {
      toast.success("Cảm ơn bạn đã đánh giá bác sĩ.");
      router.push("/patient/history");
    },
  });

  const doctor = doctorQuery.data;
  const eligibility = eligibilityQuery.data;

  return (
    <PatientShell title="Đánh giá bác sĩ">
      <div className="mb-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          href="/patient/history"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại lịch sử khám
        </Link>
      </div>

      <section className="mx-auto max-w-2xl rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
        {doctorQuery.isLoading || eligibilityQuery.isLoading ? (
          <LoadingBlock label="Đang kiểm tra quyền đánh giá..." />
        ) : doctorQuery.isError || eligibilityQuery.isError ? (
          <ErrorState message="Chưa kiểm tra được quyền đánh giá bác sĩ." />
        ) : !eligibility?.canReview ? (
          <EmptyState
            description={
              eligibility?.reason === "ALREADY_REVIEWED"
                ? "Bạn đã gửi đánh giá cho bác sĩ này trước đó."
                : "Bạn cần có ít nhất một buổi khám hoàn thành với bác sĩ này."
            }
            title="Chưa thể đánh giá"
          />
        ) : (
          <>
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Star aria-hidden="true" className="size-7 fill-current" />
              </span>
              <p className="mt-4 text-sm font-semibold uppercase text-primary">
                Sau buổi khám
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Đánh giá {doctor?.fullName ?? "bác sĩ"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Đánh giá giúp bệnh nhân khác có thêm thông tin trước khi đặt
                lịch.
              </p>
            </div>

            <form
              className="mt-6 grid gap-4"
              onSubmit={form.handleSubmit((values) =>
                reviewMutation.mutate(values),
              )}
            >
              <Field
                error={form.formState.errors.rating?.message}
                label="Số sao"
              >
                <Select {...form.register("rating")}>
                  <option value={5}>5 sao - Rất hài lòng</option>
                  <option value={4}>4 sao - Hài lòng</option>
                  <option value={3}>3 sao - Bình thường</option>
                  <option value={2}>2 sao - Chưa hài lòng</option>
                  <option value={1}>1 sao - Không hài lòng</option>
                </Select>
              </Field>

              <Field
                error={form.formState.errors.comment?.message}
                hint="Nhận xét là tùy chọn."
                label="Nhận xét"
              >
                <Textarea
                  placeholder="Chia sẻ trải nghiệm tư vấn của bạn..."
                  {...form.register("comment")}
                />
              </Field>

              <Button
                disabled={reviewMutation.isPending}
                type="submit"
                variant="success"
              >
                {reviewMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="size-4" />
                )}
                Gửi đánh giá
              </Button>
            </form>
          </>
        )}
      </section>
    </PatientShell>
  );
}
