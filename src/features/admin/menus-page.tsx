"use client";

import { getErrorMessage } from "@/lib/api/error-message";

import {
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "@/lib/auth/use-session-mutation";
import { isCurrentLogin } from "@/lib/auth/session-ownership";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api/client";
import {
  getAdminMenu,
  saveMenu,
  type MenuItem,
  type MenuRole,
} from "@/lib/api/menus";
import { useAuthStore } from "@/lib/auth/session-store";
import { cn } from "@/lib/utils";

type DraftItem = MenuItem & { isNew?: boolean };
type DraftState = { role: MenuRole; version: number; items: DraftItem[] };
const roles: [MenuRole, string][] = [
  ["PATIENT", "Bệnh nhân"],
  ["DOCTOR", "Bác sĩ"],
  ["ADMIN", "Quản trị viên"],
];

export function AdminMenusPage() {
  const [role, setRole] = useState<MenuRole>("PATIENT");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editing, setEditing] = useState<DraftItem | null>(null);
  const [label, setLabel] = useState("");
  const [iconKey, setIconKey] = useState("");
  const [newPath, setNewPath] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const accessToken = useAuthStore((state) => state.accessToken) ?? "";
  const loginId = useAuthStore((state) => state.loginId);
  const queryClient = useQueryClient();
  const auth = { accessToken, loginId };
  const query = useQuery({
    queryKey: ["admin", "menus", role],
    queryFn: () => getAdminMenu(role, auth),
    enabled: Boolean(accessToken),
  });
  const menu = query.data;
  const items = draft?.role === role ? draft.items : (menu?.items ?? []);
  const dirty = draft?.role === role;

  const available =
    menu?.pages?.filter(
      (page) => !items.some((item) => item.path === page.path),
    ) ?? [];
  const mutation = useSessionMutation({
    mutationFn: () =>
      saveMenu(
        role,
        {
          version: draft!.version,
          items: draft!.items.map((item) => ({
            ...(item.isNew ? {} : { id: item.id }),
            label: item.label.trim(),
            path: item.path,
            iconKey: item.iconKey,
            enabled: item.enabled,
          })),
        },
        auth,
      ),
    onSuccess: (data) => {
      if (!isCurrentLogin(loginId)) return;
      queryClient.setQueryData(["admin", "menus", role], data);
      setDraft(null);
      setEditing(null);
      setNewPath("");
      toast.success("Đã áp dụng cấu hình menu");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "MENU_VERSION_CONFLICT")
        toast.error(
          "Một quản trị viên khác đã cập nhật menu. Hãy tải lại rồi thực hiện lại thay đổi.",
        );
      else
        toast.error(
          getErrorMessage(error, "Không thể lưu menu"),
        );
    },
  });
  const change = (updater: (items: DraftItem[]) => DraftItem[]) => {
    setDraft((current) => {
      const base =
        current?.role === role
          ? current
          : menu
            ? { role, version: menu.version, items: menu.items }
            : null;
      return base ? { ...base, items: updater(base.items) } : current;
    });
  };
  const reload = async () => {
    const result = await query.refetch();
    if (result.data) {
      setDraft(null);
      setEditing(null);
    }
  };
  const selectRole = (next: MenuRole) => {
    if (dirty && !confirm("Bỏ các thay đổi chưa lưu?")) return;
    setDraft(null);
    setEditing(null);
    setRole(next);
  };
  const startEdit = (item: DraftItem) => {
    setEditing(item);
    setLabel(item.label);
    setIconKey(item.iconKey);
  };
  const finishEdit = () => {
    if (!editing || !label.trim()) return;
    change((items) =>
      items.map((item) =>
        item.id === editing.id
          ? { ...item, label: label.trim(), iconKey }
          : item,
      ),
    );
    setEditing(null);
  };
  const add = () => {
    const page = available.find((item) => item.path === newPath);
    if (!page) return;
    change((items) => [
      ...items,
      {
        id: `new-${crypto.randomUUID()}`,
        role,
        label: page.label,
        path: page.path,
        iconKey: page.iconKey,
        badgeKey: page.badgeKey ?? null,
        order: items.length,
        enabled: true,
        isNew: true,
      },
    ]);
    setNewPath("");
  };
  const dropAt = (targetIndex: number) => {
    if (!draggingId) return;
    change((items) => {
      const from = items.findIndex((item) => item.id === draggingId);
      if (from < 0 || from === targetIndex) return items;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggingId(null);
  };

  return (
    <AdminShell title="Quản lý menu">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
            role="tablist"
          >
            {roles.map(([value, name]) => (
              <button
                aria-selected={role === value}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-semibold",
                  role === value
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-50",
                )}
                key={value}
                onClick={() => selectRole(value)}
                role="tab"
                type="button"
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              disabled={query.isFetching || mutation.isPending}
              onClick={() => void reload()}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-4" />
              Tải lại
            </Button>
            <Button
              disabled={
                !dirty ||
                mutation.isPending ||
                !draft ||
                items.some((item) => !item.label.trim())
              }
              onClick={() => mutation.mutate()}
              size="sm"
            >
              <Save className="size-4" />
              {mutation.isPending ? "Đang lưu" : "Lưu thay đổi"}
            </Button>
          </div>
        </div>

        {query.isLoading ? (
          <LoadingBlock />
        ) : query.isError ? (
          <p className="py-10 text-center text-sm text-red-600">
            Không tải được cấu hình menu.
          </p>
        ) : menu ? (
          <>
            <section className="space-y-3" aria-labelledby="menu-list-title">
              <div>
                <h2
                  className="text-base font-bold text-slate-900"
                  id="menu-list-title"
                >
                  Thứ tự hiển thị
                </h2>
              </div>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    className={cn(
                      "grid gap-3 rounded-lg border bg-white px-3 py-3 transition md:grid-cols-[auto_minmax(0,1fr)_180px_auto] md:items-center",
                      draggingId === item.id
                        ? "border-primary opacity-50"
                        : "border-slate-200",
                    )}
                    draggable
                    key={item.id}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => setDraggingId(item.id)}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropAt(index);
                    }}
                  >
                    <button
                      aria-label={`Kéo để sắp xếp ${item.label}`}
                      className="cursor-grab touch-none rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
                      title="Kéo để sắp xếp"
                      type="button"
                    >
                      <GripVertical className="size-5" />
                    </button>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {item.label}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.path}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        checked={item.enabled}
                        disabled={item.protected}
                        onChange={(event) =>
                          change((items) =>
                            items.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, enabled: event.target.checked }
                                : entry,
                            ),
                          )
                        }
                        type="checkbox"
                      />
                      Hiển thị
                    </label>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        aria-label="Chỉnh sửa"
                        onClick={() => startEdit(item)}
                        size="sm"
                        title="Chỉnh sửa"
                        variant="ghost"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        aria-label="Xóa"
                        disabled={item.protected}
                        onClick={() => {
                          if (confirm(`Xóa mục “${item.label}” khỏi bản nháp?`))
                            change((items) =>
                              items.filter((entry) => entry.id !== item.id),
                            );
                        }}
                        size="sm"
                        title="Xóa"
                        variant="ghost"
                      >
                        <Trash2 className="size-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              className="border-t border-slate-200 pt-5"
              aria-labelledby="add-title"
            >
              <h2 className="text-base font-bold text-slate-900" id="add-title">
                Thêm mục menu
              </h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select
                  className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  onChange={(event) => setNewPath(event.target.value)}
                  value={newPath}
                >
                  <option value="">Chọn trang chưa có trong menu</option>
                  {available.map((page) => (
                    <option key={page.path} value={page.path}>
                      {page.label} ({page.path})
                    </option>
                  ))}
                </select>
                <Button disabled={!newPath} onClick={add}>
                  <Plus className="size-4" />
                  Thêm vào bản nháp
                </Button>
              </div>
              {!available.length ? (
                <p className="mt-2 text-sm text-slate-500">
                  Tất cả trang hợp lệ của vai trò này đã có trong menu.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>

      {editing && menu ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"
          role="dialog"
        >
          <form
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              finishEdit();
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Chỉnh sửa mục menu
              </h2>
              <Button
                aria-label="Đóng"
                onClick={() => setEditing(null)}
                size="sm"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            </div>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Tên hiển thị
              <input
                autoFocus
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal"
                maxLength={60}
                onChange={(event) => setLabel(event.target.value)}
                required
                value={label}
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Biểu tượng
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"
                onChange={(event) => setIconKey(event.target.value)}
                value={iconKey}
              >
                {menu.icons?.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => setEditing(null)} variant="outline">
                Hủy
              </Button>
              <Button disabled={!label.trim()} type="submit">
                Cập nhật bản nháp
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </AdminShell>
  );
}
