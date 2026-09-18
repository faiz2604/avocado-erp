"use server";

import { revalidatePath } from "next/cache";
import {
  transferFunds,
  recordCapital,
  recordExpense,
  recordReceivablePayment,
  recordPayablePayment
} from "@/lib/transactions";
import { requireRole, wrap } from "./session";

export async function transferFundsAction(input: { fromAccountId: string; toAccountId: string; amount: number; notes?: string }) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const result = await wrap(() => transferFunds({ ...input, userId: user.id }));
  if (result.ok) revalidatePath("/cash");
  return result;
}

export async function recordCapitalAction(input: { accountId: string; amount: number; notes?: string }) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const result = await wrap(() => recordCapital({ ...input, userId: user.id }));
  if (result.ok) {
    revalidatePath("/cash");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function recordExpenseAction(input: {
  categoryId: string;
  description?: string;
  amount: number;
  accountId: string;
  vendor?: string;
  notes?: string;
  date?: string;
}) {
  const user = await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => recordExpense({ ...input, userId: user.id }));
  if (result.ok) {
    revalidatePath("/expenses");
    revalidatePath("/cash");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function recordReceivablePaymentAction(input: { receivableId: string; amount: number; accountId: string; notes?: string }) {
  const user = await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => recordReceivablePayment({ ...input, userId: user.id }));
  if (result.ok) {
    revalidatePath("/receivables");
    revalidatePath("/cash");
    revalidatePath("/sales");
  }
  return result;
}

export async function recordPayablePaymentAction(input: { payableId: string; amount: number; accountId: string; notes?: string }) {
  const user = await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => recordPayablePayment({ ...input, userId: user.id }));
  if (result.ok) {
    revalidatePath("/payables");
    revalidatePath("/cash");
    revalidatePath("/purchases");
  }
  return result;
}
