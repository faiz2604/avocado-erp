"use server";

import { revalidatePath } from "next/cache";
import { createPurchase, type CreatePurchaseInput } from "@/lib/transactions";
import { requireRole, wrap } from "./session";

export async function createPurchaseAction(input: Omit<CreatePurchaseInput, "userId">) {
  const user = await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => createPurchase({ ...input, userId: user.id }));
  if (result.ok) {
    revalidatePath("/purchases");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/payables");
  }
  return result;
}
