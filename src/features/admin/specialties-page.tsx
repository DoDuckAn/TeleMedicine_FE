"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SpecialtyStatusBadge } from "@/components/admin/admin-badges";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  addDoctorToSpecialty,
  createAdminSpecialty,
  deleteAdminSpecialty,
  listAdminDoctors,
  listAdminSpecialties,
  removeDoctorFromSpecialty,
  updateAdminSpecialty,
} from "@/lib/api/admin";
import { nullableText } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
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
  const auth = { accessToken: accessToken ?? "" };
  const [form, setForm] = useState<SpecialtyForm>(emptyForm);
  const [doctorSelects, setDoctorSelects] = useState<Record<string, string>>(
    {},
  );

  const specialtiesQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAdminSpecialties(auth),
    queryKey: ["admin", "specialties"],
  });

  const doctorsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      listAdminDoctors(
        {
          limit: 100,
          order: "asc",
          sortBy: "fullName",
          status: "ACTIVE",
        },
        auth,
      ),
    queryKey: ["admin", "doctors", "active-options"],
  });

  const createMutation = useMutation({
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
      toast.error("Không tạo được chuyên khoa.");
    },
    onSuccess: () => {
      toast.success("Đã tạo chuyên khoa.");
      setForm(emptyForm);
      invalidateSpecialties(queryClient);
    },
  });

  const updateMutation = useMutation({
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
      toast.error("Không cập nhật được chuyên khoa.");
    },
    onSuccess: () => {
      toast.success("Đã cập nhật chuyên khoa.");
      setForm(emptyForm);
      invalidateSpecialties(queryClient);
    },
  });

  const disableMutation = useMutation({
    mutationFn: (specialtyId: string) =>
      deleteAdminSpecialty(specialtyId, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không ẩn được chuyên khoa.");
    },
    onSuccess: () => {
      toast.success("Đã ẩn chuyên khoa.");
      invalidateSpecialties(queryClient);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (specialtyId: string) =>
      updateAdminSpecialty(specialtyId, { status: "ACTIVE" }, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không khôi phục được chuyên khoa.");
    },
    onSuccess: () => {
      toast.success("Đã khôi phục chuyên khoa.");
      invalidateSpecialties(queryClient);
    },
  });

  const addDoctorMutation = useMutation({
    mutationFn: ({
      doctorId,
      specialtyId,
    }: {
      doctorId: string;
      specialtyId: string;
    }) => addDoctorToSpecialty(specialtyId, doctorId, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không gán được bác sĩ.");
    },
    onSuccess: () => {
      toast.success("Đã gán bác sĩ vào chuyên khoa.");
      setDoctorSelects({});
      invalidateSpecialties(queryClient);
    },
  });

  const removeDoctorMutation = useMutation({
    mutationFn: ({
      doctorId,
      specialtyId,
    }: {
      doctorId: string;
      specialtyId: string;
    }) => removeDoctorFromSpecialty(specialtyId, doctorId, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không gỡ được bác sĩ khỏi chuyên khoa.");
    },
    onSuccess: () => {
      toast.success("Đã gỡ bác sĩ khỏi chuyên khoa.");
      invalidateSpecialties(queryClient);
    },
  });

  const specialties = specialtiesQuery.data ?? [];
  const doctors = doctorsQuery.data?.items ?? [];

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
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Chuyên khoa
          </h1>

          <div className="mt-5 grid gap-4">
            <Field label="Mã chuyên khoa">
              <Input
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

        <div className="space-y-4">
          {specialtiesQuery.isLoading ? (
            <LoadingBlock label="Đang tải chuyên khoa..." />
          ) : specialtiesQuery.isError ? (
            <ErrorState message="Chưa tải được danh sách chuyên khoa." />
          ) : specialties.length ? (
            specialties.map((specialty) => {
              const currentDoctorIds = new Set(
                specialty.doctors?.map((doctor) => doctor.userID) ?? [],
              );
              const selectedDoctorId = doctorSelects[specialty.id] ?? "";
              const canAdd = Boolean(
                selectedDoctorId &&
                specialty.status === "ACTIVE" &&
                !currentDoctorIds.has(selectedDoctorId),
              );

              return (
                <article
                  className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm"
                  key={specialty.id}
                >
                  <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SpecialtyStatusBadge status={specialty.status} />
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-primary">
                          {specialty.code}
                        </span>
                      </div>
                      <h2 className="mt-3 text-2xl font-bold text-slate-900">
                        {specialty.name}
                      </h2>
                      <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
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

                  <div className="mt-5 border-t border-blue-100 pt-5">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <Select
                        aria-label="Chọn bác sĩ"
                        disabled={
                          doctorsQuery.isLoading ||
                          specialty.status !== "ACTIVE"
                        }
                        onChange={(event) =>
                          setDoctorSelects((current) => ({
                            ...current,
                            [specialty.id]: event.target.value,
                          }))
                        }
                        value={selectedDoctorId}
                      >
                        <option value="">Chọn bác sĩ để gán</option>
                        {doctors
                          .filter(
                            (doctor) => !currentDoctorIds.has(doctor.userID),
                          )
                          .map((doctor) => (
                            <option key={doctor.userID} value={doctor.userID}>
                              {doctor.fullName}
                            </option>
                          ))}
                      </Select>
                      <Button
                        disabled={!canAdd || addDoctorMutation.isPending}
                        onClick={() =>
                          addDoctorMutation.mutate({
                            doctorId: selectedDoctorId,
                            specialtyId: specialty.id,
                          })
                        }
                        variant="success"
                      >
                        <UserPlus aria-hidden="true" className="size-4" />
                        Gán bác sĩ
                      </Button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {specialty.doctors?.length ? (
                        specialty.doctors.map((doctor) => (
                          <span
                            className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-sm font-semibold text-primary"
                            key={doctor.userID}
                          >
                            {doctor.fullName}
                            <button
                              className="text-slate-500 hover:text-destructive"
                              disabled={removeDoctorMutation.isPending}
                              onClick={() =>
                                removeDoctorMutation.mutate({
                                  doctorId: doctor.userID,
                                  specialtyId: specialty.id,
                                })
                              }
                              type="button"
                            >
                              <X aria-hidden="true" className="size-3.5" />
                              <span className="sr-only">Gỡ bác sĩ</span>
                            </button>
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Chưa có bác sĩ active thuộc chuyên khoa này.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              description="Tạo chuyên khoa đầu tiên để admin có thể gán bác sĩ."
              title="Chưa có chuyên khoa"
            />
          )}
        </div>
      </section>
    </AdminShell>
  );
}

function invalidateSpecialties(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["admin", "specialties"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] });
  queryClient.invalidateQueries({ queryKey: ["public", "specialties"] });
}
