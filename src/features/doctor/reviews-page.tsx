"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "@/lib/auth/use-session-mutation";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MessageSquareReply,
  Send,
  Star,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DoctorShell } from "@/components/doctor/doctor-shell";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { getDoctorOwnReviews, replyDoctorReview } from "@/lib/api/doctor";
import { useAuthStore } from "@/lib/auth/session-store";
import { getDoctorReviewReply } from "@/lib/doctor-reviews";
import { formatDateTime, formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DoctorReview, DoctorReviewStatus } from "@/types/api";

type RepliedFilter = "" | "false" | "true";

const statusOptions: { label: string; value: DoctorReviewStatus | "" }[] = [
  { label: "Tất cả trạng thái", value: "" },
  { label: "Đang hiển thị", value: "PUBLISHED" },
  { label: "Đã ẩn", value: "HIDDEN" },
];

export function DoctorReviewsPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginId = useAuthStore((state) => state.loginId);
  const auth = { accessToken: accessToken ?? "", loginId };
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState<number | "">("");
  const [status, setStatus] = useState<DoctorReviewStatus | "">("");
  const [replied, setReplied] = useState<RepliedFilter>("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const reviewsQuery = useQuery({
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
    queryFn: () =>
      getDoctorOwnReviews(
        {
          limit: 8,
          page,
          rating,
          replied: replied === "" ? "" : replied === "true",
          status,
        },
        auth,
      ),
    queryKey: ["doctor", "reviews", { page, rating, replied, status }],
  });

  const replyMutation = useSessionMutation({
    mutationFn: ({
      content,
      reviewId,
    }: {
      content: string;
      reviewId: string;
    }) => replyDoctorReview(reviewId, { content }, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không gửi được phản hồi đánh giá.");
    },
    onSuccess: async (_, variables) => {
      toast.success("Đã gửi phản hồi đánh giá.");
      setReplyDrafts((current) => ({
        ...current,
        [variables.reviewId]: "",
      }));
      await queryClient.invalidateQueries({ queryKey: ["doctor", "reviews"] });
      await queryClient.invalidateQueries({ queryKey: ["public", "doctor"] });
    },
  });

  const reviews = reviewsQuery.data?.items ?? [];
  const totalPages = reviewsQuery.data?.pagination.totalPages ?? 1;

  function reply(reviewId: string) {
    const content = replyDrafts[reviewId]?.trim();

    if (!content) {
      toast.error("Nhập nội dung phản hồi.");
      return;
    }

    replyMutation.mutate({ content, reviewId });
  }

  return (
    <DoctorShell title="Đánh giá">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Phản hồi bệnh nhân
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Đánh giá của tôi
              </h1>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-amber-700">
              <p className="text-sm font-semibold">Điểm trung bình</p>
              <p className="mt-1 text-2xl font-bold">
                {formatRating(reviewsQuery.data?.summary?.ratingAverage)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-blue-100 pt-5 md:grid-cols-3">
            <Select
              aria-label="Lọc số sao"
              onChange={(event) => {
                setRating(event.target.value ? Number(event.target.value) : "");
                setPage(1);
              }}
              value={rating}
            >
              <option value="">Tất cả số sao</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} sao
                </option>
              ))}
            </Select>
            <Select
              aria-label="Lọc trạng thái"
              onChange={(event) => {
                setStatus(event.target.value as DoctorReviewStatus | "");
                setPage(1);
              }}
              value={status}
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Lọc phản hồi"
              onChange={(event) => {
                setReplied(event.target.value as RepliedFilter);
                setPage(1);
              }}
              value={replied}
            >
              <option value="">Tất cả phản hồi</option>
              <option value="false">Chưa phản hồi</option>
              <option value="true">Đã phản hồi</option>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {reviewsQuery.isLoading ? (
            <LoadingBlock label="Đang tải đánh giá..." />
          ) : reviewsQuery.isError ? (
            <ErrorState message="Chưa tải được đánh giá của bác sĩ." />
          ) : reviews.length ? (
            reviews.map((review) => (
              <ReviewCard
                draft={replyDrafts[review.id] ?? ""}
                isReplying={
                  replyMutation.isPending &&
                  replyMutation.variables?.reviewId === review.id
                }
                key={review.id}
                onDraftChange={(value) =>
                  setReplyDrafts((current) => ({
                    ...current,
                    [review.id]: value,
                  }))
                }
                onReply={() => reply(review.id)}
                review={review}
              />
            ))
          ) : (
            <EmptyState
              description="Đánh giá phù hợp với bộ lọc hiện tại sẽ hiển thị tại đây."
              title="Chưa có đánh giá"
            />
          )}
        </div>

        {reviews.length ? (
          <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Trang trước
            </Button>
            <p className="text-sm font-semibold text-slate-700">
              Trang {page} / {totalPages}
            </p>
            <Button
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              variant="outline"
            >
              Trang sau
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ) : null}
      </section>
    </DoctorShell>
  );
}

function ReviewCard({
  draft,
  isReplying,
  onDraftChange,
  onReply,
  review,
}: {
  draft: string;
  isReplying: boolean;
  onDraftChange: (value: string) => void;
  onReply: () => void;
  review: DoctorReview;
}) {
  const reply = getDoctorReviewReply(review);
  const patientName =
    review.patient?.fullName ?? review.patientDisplayName ?? "Bệnh nhân";

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-700">
              {Array.from({ length: review.rating }).map((_, index) => (
                <Star
                  aria-hidden="true"
                  className="size-4 fill-current"
                  key={index}
                />
              ))}
            </span>
            <span
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-bold",
                review.status === "HIDDEN"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-green-50 text-green-700",
              )}
            >
              {review.status === "HIDDEN" ? "Đã ẩn" : "Đang hiển thị"}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">
            {patientName}
          </h2>
          {review.createdAt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateTime(review.createdAt)}
            </p>
          ) : null}
        </div>

        {reply ? (
          <span className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm font-bold text-primary">
            <MessageSquareReply aria-hidden="true" className="size-4" />
            Đã phản hồi
          </span>
        ) : null}
      </div>

      <p className="mt-4 leading-7 text-slate-700">
        {review.comment ?? "Bệnh nhân không để lại nhận xét."}
      </p>

      {review.hiddenReason ? (
        <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm leading-6 text-slate-600">
          Lý do ẩn: {review.hiddenReason}
        </p>
      ) : null}

      {reply ? (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
          <p className="text-sm font-semibold text-primary">
            Phản hồi của bác sĩ
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{reply}</p>
          {review.repliedAt ? (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              {formatDateTime(review.repliedAt)}
            </p>
          ) : null}
        </div>
      ) : review.status !== "HIDDEN" ? (
        <div className="mt-4 grid gap-3 border-t border-blue-100 pt-4">
          <Field label="Phản hồi">
            <Textarea
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Nhập phản hồi cho bệnh nhân..."
              value={draft}
            />
          </Field>
          <Button
            className="justify-self-start"
            disabled={!draft.trim() || isReplying}
            onClick={onReply}
            variant="success"
          >
            {isReplying ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
            Gửi phản hồi
          </Button>
        </div>
      ) : null}
    </article>
  );
}
