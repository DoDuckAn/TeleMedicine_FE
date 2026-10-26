"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "@/lib/auth/use-session-mutation";
import { isCurrentLogin } from "@/lib/auth/session-ownership";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Save,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listAdminDoctors, updateSpecialtyDoctors } from "@/lib/api/admin";
import { useAuthStore } from "@/lib/auth/session-store";
import type { Specialty } from "@/types/api";

export function SpecialtyDoctorsModal({
  specialty,
  onClose,
}: {
  specialty: Specialty;
  onClose: () => void;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginId = useAuthStore((state) => state.loginId);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"assigned" | "search">("assigned");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [changes, setChanges] = useState<
    Record<string, { name: string; add: boolean }>
  >({});
  const q = useDebouncedValue(keyword, 300);
  const doctors = useQuery({
    enabled: Boolean(accessToken),
    queryKey: ["admin", "specialty-doctors", specialty.id, mode, q, page],
    queryFn: () =>
      listAdminDoctors(
        {
          q,
          page,
          limit: 10,
          sortBy: "fullName",
          order: "asc",
          specialtyId: mode === "assigned" ? specialty.id : undefined,
          status: mode === "search" ? "ACTIVE" : undefined,
        },
        { accessToken: accessToken!, loginId },
      ),
  });
  const save = useSessionMutation({
    mutationFn: () =>
      updateSpecialtyDoctors(
        specialty.id,
        {
          addDoctorIds: Object.keys(changes).filter((id) => changes[id].add),
          removeDoctorIds: Object.keys(changes).filter(
            (id) => !changes[id].add,
          ),
        },
        { accessToken: accessToken!, loginId },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "specialties"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "specialty-doctors"],
        }),
        queryClient.invalidateQueries({ queryKey: ["public"] }),
      ]);
      if (!isCurrentLogin(loginId)) return;
      toast.success("Đã lưu danh sách bác sĩ.");
      onClose();
    },
    onError: () =>
      toast.error("Không lưu được danh sách. Các thay đổi chưa được áp dụng."),
  });
  function undo(id: string) {
    setChanges((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  return (
    <Modal label={"Bác sĩ - " + specialty.name} onClose={onClose}>
      <section className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-soft">
        <div className="sticky -top-5 z-10 flex items-center justify-between gap-3 bg-white py-3">
          <h2 className="text-xl font-bold">Bác sĩ - {specialty.name}</h2>
          <Button
            aria-label="Đóng"
            title="Đóng"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="my-4 flex gap-2">
          <Button
            variant={mode === "assigned" ? "primary" : "outline"}
            onClick={() => {
              setMode("assigned");
              setPage(1);
            }}
          >
            Đã gán
          </Button>
          <Button
            disabled={specialty.status !== "ACTIVE"}
            variant={mode === "search" ? "primary" : "outline"}
            onClick={() => {
              setMode("search");
              setPage(1);
            }}
          >
            <Plus className="size-4" />
            Thêm bác sĩ
          </Button>
        </div>
        <label className="relative block">
          <Search className="absolute left-3 top-3 size-4 text-slate-500" />
          <Input
            aria-label="Tìm bác sĩ"
            className="pl-9"
            placeholder="Tìm tên hoặc email bác sĩ"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="my-4 min-h-32 divide-y divide-blue-100">
          {doctors.isLoading ? (
            <LoadingBlock />
          ) : doctors.isError ? (
            <ErrorState message="Không tải được danh sách bác sĩ." />
          ) : (
            doctors.data?.items.map((doctor) => {
              const assigned =
                doctor.specialties?.some((item) => item.id === specialty.id) ??
                false;
              const change = changes[doctor.userID];
              return (
                <div
                  key={doctor.userID}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{doctor.fullName}</p>
                    <p className="break-all text-sm text-slate-500">
                      {doctor.user.email}
                    </p>
                  </div>
                  {change ? (
                    <Button
                      disabled={save.isPending}
                      title="Hoàn tác"
                      aria-label={"Hoàn tác " + doctor.fullName}
                      variant="ghost"
                      onClick={() => undo(doctor.userID)}
                    >
                      <Undo2 className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      disabled={
                        save.isPending ||
                        (!assigned && specialty.status !== "ACTIVE")
                      }
                      title={assigned ? "Gỡ bác sĩ" : "Thêm bác sĩ"}
                      aria-label={
                        (assigned ? "Gỡ " : "Thêm ") + doctor.fullName
                      }
                      variant={assigned ? "outline" : "success"}
                      onClick={() =>
                        setChanges((current) => ({
                          ...current,
                          [doctor.userID]: {
                            name: doctor.fullName,
                            add: !assigned,
                          },
                        }))
                      }
                    >
                      {assigned ? (
                        <X className="size-4" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
          {doctors.isSuccess && !doctors.data.items.length && (
            <p className="py-5">Không tìm thấy bác sĩ.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button
            aria-label="Trang trước"
            title="Trang trước"
            variant="outline"
            disabled={page <= 1 || doctors.isFetching}
            onClick={() => setPage((current) => current - 1)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="whitespace-nowrap text-sm">
            Trang {page} /{" "}
            {Math.max(1, doctors.data?.pagination.totalPages ?? 1)}
          </span>
          <Button
            aria-label="Trang sau"
            title="Trang sau"
            variant="outline"
            disabled={
              page >= (doctors.data?.pagination.totalPages ?? 1) ||
              doctors.isFetching
            }
            onClick={() => setPage((current) => current + 1)}
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
        {!!Object.keys(changes).length && (
          <div className="mt-4 border-t pt-3">
            <h3 className="font-semibold">
              Thay đổi chưa lưu ({Object.keys(changes).length})
            </h3>
            {Object.entries(changes).map(([id, change]) => (
              <div
                key={id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <span>
                  {change.add ? "Thêm" : "Gỡ"}: {change.name}
                </span>
                <Button
                  disabled={save.isPending}
                  aria-label={"Hoàn tác " + change.name}
                  title="Hoàn tác"
                  variant="ghost"
                  onClick={() => undo(id)}
                >
                  <Undo2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="sticky -bottom-5 mt-4 flex justify-end gap-2 border-t bg-white py-4">
          <Button onClick={onClose} variant="outline">
            Hủy
          </Button>
          <Button
            disabled={!Object.keys(changes).length || save.isPending}
            onClick={() => save.mutate()}
          >
            <Save className="size-4" />
            {save.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </section>
    </Modal>
  );
}
