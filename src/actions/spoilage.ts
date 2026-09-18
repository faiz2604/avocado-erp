"use server";

import { revalidatePath } from "next/cache";
import { recordSpoilage, type RecordSpoilageInput } from "@/lib/transactions";
import { requireRole, wrap } from "./session";

export async function recordSpoilageAction(input: Omit<RecordSpoilageInput, "userId">) {
  const user = await requireRole(["ADMIN", "MANAGER", "STAFF"]);
  const result = await wrap(() => recordSpoilage({ ...input, userId: user.id }));
  if (result.ok) {
    revalidatePath("/spoilage");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
  }
  return result;
}
