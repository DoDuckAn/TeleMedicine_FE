"use client";

import { getErrorMessage } from "@/lib/api/error-message";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSessionMutation } from "@/lib/auth/use-session-mutation";
import { Loader2, Plus, Save, Search, Trash2, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SpecialtyDoctorsModal } from "@/components/admin/specialty-doctors-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { SpecialtyStatusBadge } from "@/components/admin/admin-badges";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  createAdminSpecialty,
  deleteAdminSpecialty,
  listAdminSpecialtyPage,
  updateAdminSpecialty,
} from "@/lib/api/admin";
import { nullableText } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Specialty, SpecialtyStatus } from "@/types/api";

type SpecialtyForm = {
  code: string;
  description: string;
  editingId: string | null;
  name: string;
  status: SpecialtyStatus;
};

const emptyForm: SpecialtyForm = {
  code: "",
  description: "",
  editingId: null,
  name: "",
  status: "ACTIVE",
};

export function AdminSpecialtiesPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginId = useAuthStore((state) => state.loginId);
  const auth = { accessToken: accessToken ?? "", loginId };
  const [form, setForm] = useState<SpecialtyForm>(emptyForm);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState<SpecialtyStatus | "">("");
  const debouncedQ = useDebouncedValue(q);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(
    null,
  );

  const specialtiesQuery = useQuery({
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
    queryFn: () =>
      listAdminSpecialtyPage(
        { page, limit, q: debouncedQ.trim() || undefined, status },
        auth,
      ),
    queryKey: ["admin", "specialties", { page, limit, q: debouncedQ, status }],
  });
  const specialties = specialtiesQuery.data?.items ?? [];
  const pagination = specialtiesQuery.data?.pagination;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  if (pagination && !specialtiesQuery.isPlaceholderData && page > totalPages) {
    setPage(totalPages);
  }

  const createMutation = useSessionMutation({
    mutationFn: () =>
      createAdminSpecialty(
        {
          code: form.code.trim(),
          description: nullableText(form.description),
          name: form.name.trim(),
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không tạo được chuyên khoa."));
    },
    onSuccess: () => {
      toast.success("Đã tạo chuyên khoa.");
      setForm(emptyForm);
      invalidateSpecialties(queryClient);
    },
  });

  const updateMutation = useSessionMutation({
    mutationFn: () =>
      updateAdminSpecialty(
        form.editingId ?? "",
        {
          code: form.code.trim(),
          description: nullableText(form.description),
          name: form.name.trim(),
          status: form.status,
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không cập nhật được chuyên khoa."));
    },
    onSuccess: () => {
      toast.success("Đã cập nhật chuyên khoa.");
      setForm(emptyForm);
      invalidateSpecialties(queryClient);
    },
  });

  const disableMutation = useSessionMutation({
    mutationFn: (specialtyId: string) =>
      deleteAdminSpecialty(specialtyId, auth),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không ẩn được chuyên khoa."));
    },
    onSuccess: () => {
      toast.success("Đã ẩn chuyên khoa.");
      invalidateSpecialties(queryClient);
    },
  });

  const restoreMutation = useSessionMutation({
    mutationFn: (specialtyId: string) =>
      updateAdminSpecialty(specialtyId, { status: "ACTIVE" }, auth),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không khôi phục được chuyên khoa."));
    },
    onSuccess: () => {
      toast.success("Đã khôi phục chuyên khoa.");
      invalidateSpecialties(queryClient);
    },
  });

  function submitForm() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Nhập mã và tên chuyên khoa.");
      return;
    }

    if (form.editingId) {
      updateMutation.mutate();
      return;
    }

    createMutation.mutate();
  }

  function editSpecialty(specialty: Specialty) {
    setForm({
      code: specialty.code,
      description: specialty.description ?? "",
      editingId: specialty.id,
      name: specialty.name,
      status: specialty.status ?? "ACTIVE",
    });
  }

  return (
    <AdminShell title="Chuyên khoa">
      <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase text-primary">
            {form.editingId ? "Cập nhật" : "Tạo mới"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Chuyên khoa
          </h1>

          <div className="mt-5 grid gap-4">
            <Field label="Mã chuyên khoa">
              <Input
                aria-label="Mã chuyên khoa"
                maxLength={32}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="UNG_BUOU"
                value={form.code}
              />
            </Field>
            <Field label="Tên chuyên khoa">
              <Input
                aria-label="Tên chuyên khoa"
                maxLength={100}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ung bướu"
                value={form.name}
              />
            </Field>
            {form.editingId ? (
              <Field label="Trạng thái">
                <Select
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as SpecialtyStatus,
                    }))
                  }
                  value={form.status}
                >
                  <option value="ACTIVE">Đang hiển thị</option>
                  <option value="DISABLED">Đã ẩn</option>
                </Select>
              </Field>
            ) : null}
            <Field label="Mô tả">
              <Textarea
                maxLength={1000}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Mô tả ngắn về chuyên khoa..."
                value={form.description}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={submitForm}
                variant="success"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : form.editingId ? (
                  <Save aria-hidden="true" className="size-4" />
                ) : (
                  <Plus aria-hidden="true" className="size-4" />
                )}
                {form.editingId ? "Lưu" : "Tạo"}
              </Button>
              {form.editingId ? (
                <Button onClick={() => setForm(emptyForm)} variant="outline">
                  <X aria-hidden="true" className="size-4" />
                  Hủy
                </Button>
              ) : null}
            </div>
          </div>
        </aside>

        <div
          className="min-w-0 space-y-4"
          aria-busy={specialtiesQuery.isFetching}
        >
          <h2 className="text-xl font-bold text-slate-900">
            Danh sách chuyên khoa
          </h2>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative min-w-0">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Tìm chuyên khoa"
                className="pl-9"
                placeholder="Tìm theo mã hoặc tên..."
                maxLength={100}
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              aria-label="Lọc trạng thái chuyên khoa"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as SpecialtyStatus | "");
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hiển thị</option>
              <option value="DISABLED">Đã ẩn</option>
            </Select>
            <Select
              aria-label="Số chuyên khoa mỗi trang"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              {[5, 10, 20].map((size) => (
                <option key={size} value={size}>
                  {size} / trang
                </option>
              ))}
            </Select>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {specialtiesQuery.isFetching
              ? "Đang tải..."
              : `${pagination?.total ?? 0} chuyên khoa`}
          </p>
          {specialtiesQuery.isLoading ? (
            <LoadingBlock label="Đang tải chuyên khoa..." />
          ) : specialtiesQuery.isError ? (
            <ErrorState message="Chưa tải được danh sách chuyên khoa." />
          ) : specialties.length ? (
            specialties.map((specialty) => {
              return (
                <article
                  className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm"
                  key={specialty.id}
                >
                  <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SpecialtyStatusBadge status={specialty.status} />
                        <span className="max-w-full break-all rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-primary">
                          {specialty.code}
                        </span>
                      </div>
                      <h2 className="mt-3 break-words text-xl font-bold text-slate-900">
                        {specialty.name}
                      </h2>
                      <p className="mt-2 max-w-2xl break-words leading-7 text-muted-foreground">
                        {specialty.description ?? "Chưa có mô tả."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => editSpecialty(specialty)}
                        variant="outline"
                      >
                        <Save aria-hidden="true" className="size-4" />
                        Sửa
                      </Button>
                      {specialty.status === "ACTIVE" ? (
                        <Button
                          disabled={disableMutation.isPending}
                          onClick={() => disableMutation.mutate(specialty.id)}
                          variant="destructive"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                          Ẩn
                        </Button>
                      ) : (
                        <Button
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(specialty.id)}
                          variant="success"
                        >
                          <Undo2 aria-hidden="true" className="size-4" />
                          Khôi phục
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-blue-100 pt-4">
                    <Button
                      onClick={() => setSelectedSpecialty(specialty)}
                      variant="outline"
                    >
                      Danh sách bác sĩ
                    </Button>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              description={
                q.trim() || status
                  ? "Thử thay đổi từ khóa hoặc bộ lọc."
                  : "Chưa có chuyên khoa để hiển thị."
              }
              title={
                q.trim() || status
                  ? "Không tìm thấy chuyên khoa"
                  : "Chưa có chuyên khoa"
              }
            />
          )}
          {!specialtiesQuery.isError && (
            <AdminPagination
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              disabled={specialtiesQuery.isFetching}
            />
          )}
        </div>
      </section>
      {selectedSpecialty && (
        <SpecialtyDoctorsModal
          specialty={selectedSpecialty}
          onClose={() => setSelectedSpecialty(null)}
        />
      )}
    </AdminShell>
  );
}

function invalidateSpecialties(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["admin", "specialties"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] });
  queryClient.invalidateQueries({ queryKey: ["public", "specialties"] });
}
