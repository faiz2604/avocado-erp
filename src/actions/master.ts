"use server";

import { revalidatePath } from "next/cache";
import * as master from "@/lib/master";
import { requireRole, requireUser, wrap } from "./session";

export async function createProductAction(input: Parameters<typeof master.createProduct>[0]) {
  await requireRole(["ADMIN", "MANAGER"]);
  const result = await wrap(() => master.createProduct(input));
  if (result.ok) revalidatePath("/products");
  return result;
}

export async function updateProductAction(id: string, input: Parameters<typeof master.updateProduct>[1]) {
  await requireRole(["ADMIN", "MANAGER"]);
  const result = await wrap(() => master.updateProduct(id, input));
  if (result.ok) {
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
  }
  return result;
}

export async function createCustomerAction(input: Parameters<typeof master.createCustomer>[0]) {
  await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => master.createCustomer(input));
  if (result.ok) revalidatePath("/customers");
  return result;
}

export async function updateCustomerAction(id: string, input: Parameters<typeof master.updateCustomer>[1]) {
  await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => master.updateCustomer(id, input));
  if (result.ok) revalidatePath("/customers");
  return result;
}

export async function createSupplierAction(input: Parameters<typeof master.createSupplier>[0]) {
  await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => master.createSupplier(input));
  if (result.ok) revalidatePath("/suppliers");
  return result;
}

export async function updateSupplierAction(id: string, input: Parameters<typeof master.updateSupplier>[1]) {
  await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => master.updateSupplier(id, input));
  if (result.ok) revalidatePath("/suppliers");
  return result;
}

export async function createAccountAction(input: Parameters<typeof master.createAccount>[0]) {
  await requireRole(["ADMIN", "MANAGER"]);
  const result = await wrap(() => master.createAccount(input));
  if (result.ok) revalidatePath("/cash");
  return result;
}

export async function createExpenseCategoryAction(input: Parameters<typeof master.createExpenseCategory>[0]) {
  await requireRole(["ADMIN", "MANAGER"]);
  const result = await wrap(() => master.createExpenseCategory(input));
  if (result.ok) revalidatePath("/expenses");
  return result;
}

export async function createUserAction(input: Parameters<typeof master.createUser>[0]) {
  await requireRole(["ADMIN"]);
  const result = await wrap(() => master.createUser(input));
  if (result.ok) revalidatePath("/settings");
  return result;
}

/** Any logged-in user can change their own name/email/password (not gated by role — it's their
 * own account). Requires their current password. */
export async function updateOwnProfileAction(input: Parameters<typeof master.updateOwnProfile>[1]) {
  const user = await requireUser();
  const result = await wrap(() => master.updateOwnProfile(user.id, input));
  if (result.ok) revalidatePath("/settings");
  return result;
}

/** Admin-only: enable/disable another user's login (e.g. disabling the default admin account
 * after creating a personal one). An admin can't deactivate their own account this way — that
 * would risk locking everyone out if they're the only admin. */
export async function setUserActiveAction(userId: string, active: boolean) {
  const admin = await requireRole(["ADMIN"]);
  if (userId === admin.id) {
    return { ok: false as const, error: "Anda tidak bisa menonaktifkan akun Anda sendiri." };
  }
  const result = await wrap(() => master.setUserActive(userId, active));
  if (result.ok) revalidatePath("/settings");
  return result;
}
