"use server";

import { revalidatePath } from "next/cache";
import { createSale, type CreateSaleInput } from "@/lib/transactions";
import { requireRole, wrap } from "./session";

export async function createSaleAction(input: Omit<CreateSaleInput, "userId">) {
  const user = await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => createSale({ ...input, userId: user.id }));
  if (result.ok) {
    revalidatePath("/sales");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/receivables");
  }
  return result;
}
