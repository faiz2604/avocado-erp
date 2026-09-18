"use server";

import { revalidatePath } from "next/cache";
import * as master from "@/lib/master";
import { requireRole, wrap } from "./session";

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
