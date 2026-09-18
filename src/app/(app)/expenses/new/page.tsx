import { listExpenseCategories, listAccounts } from "@/lib/master";
import ExpenseNewClient from "./ExpenseNewClient";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  await getDb();
  const categories = listExpenseCategories(true) as any[];
  const accounts = listAccounts(true) as any[];
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Expense Baru</h1>
      {accounts.length === 0 ? (
        <div className="card text-sm text-slate-600">Tambahkan minimal 1 akun kas/bank terlebih dahulu di menu Cash & Bank.</div>
      ) : (
        <ExpenseNewClient categories={categories} accounts={accounts} />
      )}
    </div>
  );
}
