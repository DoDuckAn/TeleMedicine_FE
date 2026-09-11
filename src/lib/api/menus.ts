import { apiFetch } from "@/lib/api/client";

export type MenuRole = "PATIENT" | "DOCTOR" | "ADMIN";
export type MenuItem = {
  id: string;
  role: MenuRole;
  label: string;
  path: string;
  iconKey: string;
  badgeKey: string | null;
  order: number;
  enabled: boolean;
  protected?: boolean;
};
export type MenuPage = {
  path: string;
  label: string;
  iconKey: string;
  badgeKey?: string;
  protected?: boolean;
};
export type RoleMenu = {
  role: MenuRole;
  version: number;
  items: MenuItem[];
  pages?: MenuPage[];
  icons?: string[];
};
type Auth = { accessToken: string };

export const getMyMenu = (auth: Auth) =>
  apiFetch<RoleMenu>("/menus/me", { accessToken: auth.accessToken });
export const getAdminMenu = (role: MenuRole, auth: Auth) =>
  apiFetch<RoleMenu>(`/admin/menus/${role}`, { accessToken: auth.accessToken });
export const createMenuItem = (
  role: MenuRole,
  input: { version: number; label: string; path: string; iconKey?: string },
  auth: Auth,
) =>
  apiFetch<RoleMenu>(`/admin/menus/${role}/items`, {
    method: "POST",
    json: input,
    accessToken: auth.accessToken,
  });
export const updateMenuItem = (
  role: MenuRole,
  id: string,
  input: {
    version: number;
    label?: string;
    iconKey?: string;
    enabled?: boolean;
  },
  auth: Auth,
) =>
  apiFetch<RoleMenu>(`/admin/menus/${role}/items/${id}`, {
    method: "PATCH",
    json: input,
    accessToken: auth.accessToken,
  });
export const reorderMenu = (
  role: MenuRole,
  input: { version: number; itemIds: string[] },
  auth: Auth,
) =>
  apiFetch<RoleMenu>(`/admin/menus/${role}/order`, {
    method: "PUT",
    json: input,
    accessToken: auth.accessToken,
  });
export const deleteMenuItem = (
  role: MenuRole,
  id: string,
  version: number,
  auth: Auth,
) =>
  apiFetch<RoleMenu>(`/admin/menus/${role}/items/${id}`, {
    method: "DELETE",
    json: { version },
    accessToken: auth.accessToken,
  });

export const saveMenu = (
  role: MenuRole,
  input: {
    version: number;
    items: Array<{
      id?: string;
      label: string;
      path: string;
      iconKey: string;
      enabled: boolean;
    }>;
  },
  auth: Auth,
) =>
  apiFetch<RoleMenu>(`/admin/menus/${role}`, {
    method: "PUT",
    json: input,
    accessToken: auth.accessToken,
  });
