"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Loader2,
  MessageSquareReply,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { ReviewStatusBadge } from "@/components/admin/admin-badges";
import { AdminShell } from "@/components/admin/admin-shell";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { listAdminReviews, moderateAdminReview } from "@/lib/api/admin";
import { nullableText } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import { getDoctorReviewReply } from "@/lib/doctor-reviews";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AdminReview, DoctorReviewStatus } from "@/types/api";

const statusOptions: { label: string; value: DoctorReviewStatus | "" }[] = [
  { label: "Tất cả trạng thái", value: "" },
  { label: "Đang hiển thị", value: "PUBLISHED" },
  { label: "Đã ẩn", value: "HIDDEN" },
];

type ModerationTarget = {
  reason: string;
  review: AdminReview;
  status: DoctorReviewStatus;
};

export function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [rating, setRating] = useState<number | "">("");
  const [status, setStatus] = useState<DoctorReviewStatus | "">("");
  const [sortBy, setSortBy] = useState<"createdAt" | "rating">("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [moderationTarget, setModerationTarget] =
    useState<ModerationTarget | null>(null);
  const debouncedQ = useDebouncedValue(q);

  const reviewsQuery = useQuery({
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
    queryFn: () =>
      listAdminReviews(
        {
          doctorId: doctorId.trim() || undefined,
          limit: 8,
          order,
          page,
          patientId: patientId.trim() || undefined,
          q: debouncedQ.trim() || undefined,
          rating,
          sortBy,
          status,
        },
        auth,
      ),
    queryKey: [
      "admin",
      "reviews",
      {
        debouncedQ,
        doctorId,
        order,
        page,
        patientId,
        rating,
        sortBy,
        status,
      },
    ],
  });

  const moderationMutation = useMutation({
    mutationFn: ({
      reason,
      reviewId,
      status: nextStatus,
    }: {
      reason: string;
      reviewId: string;
      status: DoctorReviewStatus;
    }) =>
      moderateAdminReview(
        reviewId,
        {
          reason:
            nextStatus === "HIDDEN"
              ? reason.trim()
              : (nullableText(reason) ?? undefined),
          status: nextStatus,
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error("Không cập nhật được trạng thái đánh giá.");
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật trạng thái đánh giá.");
      setModerationTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
      await queryClient.invalidateQueries({ queryKey: ["public", "doctor"] });
    },
  });

  const reviews = reviewsQuery.data?.items ?? [];
  const totalPages = reviewsQuery.data?.pagination.totalPages ?? 1;

  function openModeration(review: AdminReview) {
    setModerationTarget({
      reason: review.hiddenReason ?? "",
      review,
      status: review.status === "HIDDEN" ? "PUBLISHED" : "HIDDEN",
    });
  }

  return (
    <AdminShell title="Đánh giá">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase text-primary">
            Kiểm duyệt review
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Đánh giá bác sĩ
          </h1>

          <div className="mt-5 grid gap-3 border-t border-blue-100 pt-5 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-9"
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm nội dung, bác sĩ, bệnh nhân..."
                value={q}
              />
            </div>
            <Input
              onChange={(event) => {
                setDoctorId(event.target.value);
                setPage(1);
              }}
              placeholder="Mã bác sĩ..."
              value={doctorId}
            />
            <Input
              onChange={(event) => {
                setPatientId(event.target.value);
                setPage(1);
              }}
              placeholder="Mã bệnh nhân..."
              value={patientId}
            />
            <Select
              aria-label="Số sao"
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
              aria-label="Trạng thái"
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
            <div className="grid grid-cols-2 gap-2 xl:col-span-2">
              <Select
                aria-label="Sắp xếp"
                onChange={(event) => {
                  setSortBy(event.target.value as "createdAt" | "rating");
                  setPage(1);
                }}
                value={sortBy}
              >
                <option value="createdAt">Ngày tạo</option>
                <option value="rating">Số sao</option>
              </Select>
              <Select
                aria-label="Thứ tự"
                onChange={(event) => {
                  setOrder(event.target.value as "asc" | "desc");
                  setPage(1);
                }}
                value={order}
              >
                <option value="desc">Giảm dần</option>
                <option value="asc">Tăng dần</option>
              </Select>
            </div>
          </div>
        </div>

        {reviewsQuery.isLoading ? (
          <LoadingBlock label="Đang tải đánh giá..." />
        ) : reviewsQuery.isError ? (
          <ErrorState message="Chưa tải được danh sách đánh giá." />
        ) : reviews.length ? (
          <>
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  onModerate={() => openModeration(review)}
                  review={review}
                />
              ))}
            </div>
            <AdminPagination
              page={page}
              setPage={setPage}
              totalPages={totalPages}
            />
          </>
        ) : (
          <EmptyState
            description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm."
            title="Chưa có đánh giá"
          />
        )}
      </section>

      {moderationTarget ? (
        <ModerationModal
          isPending={moderationMutation.isPending}
          onChange={setModerationTarget}
          onClose={() => setModerationTarget(null)}
          onSubmit={() => {
            if (
              moderationTarget.status === "HIDDEN" &&
              !moderationTarget.reason.trim()
            ) {
              toast.error("Nhập lý do ẩn đánh giá.");
              return;
            }

            moderationMutation.mutate({
              reason: moderationTarget.reason,
              reviewId: moderationTarget.review.id,
              status: moderationTarget.status,
            });
          }}
          target={moderationTarget}
        />
      ) : null}
    </AdminShell>
  );
}

function ReviewCard({
  onModerate,
  review,
}: {
  onModerate: () => void;
  review: AdminReview;
}) {
  const reply = getDoctorReviewReply(review);
  const doctorName = review.doctor?.fullName ?? "Bác sĩ";
  const patientName =
    review.patient?.fullName ?? review.patientDisplayName ?? "Bệnh nhân";

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
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
            <ReviewStatusBadge status={review.status} />
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">
            {review.comment ?? "Bệnh nhân không để lại nhận xét."}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {review.createdAt
              ? formatDateTime(review.createdAt)
              : "Chưa rõ ngày tạo"}
          </p>
        </div>
        <Button
          onClick={onModerate}
          variant={review.status === "HIDDEN" ? "success" : "destructive"}
        >
          <ShieldCheck aria-hidden="true" className="size-4" />
          {review.status === "HIDDEN" ? "Hiển thị lại" : "Ẩn đánh giá"}
        </Button>
      </div>

      <div className="mt-5 grid gap-3 border-t border-blue-100 pt-5 md:grid-cols-2">
        <Info
          label="Bác sĩ"
          value={
            review.doctor?.userID ? (
              <Link
                className="font-bold text-primary hover:underline"
                href={`/admin/doctors/${review.doctor.userID}`}
              >
                {doctorName}
              </Link>
            ) : (
              doctorName
            )
          }
        />
        <Info
          label="Bệnh nhân"
          value={
            review.patient?.userID ? (
              <Link
                className="font-bold text-primary hover:underline"
                href={`/admin/patients/${review.patient.userID}`}
              >
                {patientName}
              </Link>
            ) : (
              patientName
            )
          }
        />
      </div>

      {reply ? (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <MessageSquareReply aria-hidden="true" className="size-4" />
            Phản hồi của bác sĩ
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{reply}</p>
          {review.repliedAt ? (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              {formatDateTime(review.repliedAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {review.hiddenReason ? (
        <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm leading-6 text-slate-600">
          Lý do ẩn: {review.hiddenReason}
        </p>
      ) : null}
    </article>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm text-slate-800">{value}</div>
    </div>
  );
}

function ModerationModal({
  isPending,
  onChange,
  onClose,
  onSubmit,
  target,
}: {
  isPending: boolean;
  onChange: (target: ModerationTarget) => void;
  onClose: () => void;
  onSubmit: () => void;
  target: ModerationTarget;
}) {
  return (
    <Modal label="Kiểm duyệt đánh giá" onClose={onClose}>
      <section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">
              Kiểm duyệt
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Trạng thái đánh giá
            </h2>
          </div>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Đóng</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <Field label="Trạng thái">
            <Select
              onChange={(event) =>
                onChange({
                  ...target,
                  status: event.target.value as DoctorReviewStatus,
                })
              }
              value={target.status}
            >
              <option value="PUBLISHED">Đang hiển thị</option>
              <option value="HIDDEN">Đã ẩn</option>
            </Select>
          </Field>
          <Field
            hint={
              target.status === "HIDDEN"
                ? "Bắt buộc khi ẩn đánh giá."
                : "Có thể để trống khi hiển thị lại."
            }
            label="Lý do"
          >
            <Textarea
              onChange={(event) =>
                onChange({ ...target, reason: event.target.value })
              }
              placeholder="Nhập lý do kiểm duyệt..."
              value={target.reason}
            />
          </Field>
          <Button
            disabled={isPending}
            onClick={onSubmit}
            variant={target.status === "HIDDEN" ? "destructive" : "success"}
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ShieldCheck aria-hidden="true" className="size-4" />
            )}
            Cập nhật
          </Button>
        </div>
      </section>
    </Modal>
  );
}
