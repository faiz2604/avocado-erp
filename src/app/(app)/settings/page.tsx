import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers, listExpenseCategories, getSettings } from "@/lib/master";
import SettingsClient from "./SettingsClient";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await getDb();
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const users = listUsers() as any[];
  const categories = listExpenseCategories() as any[];
  const settings = getSettings();

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
      <div className="card mt-3 mb-6 text-sm">
        <div className="flex justify-between py-1"><span className="text-slate-500">Nama Usaha</span><span className="font-medium">{settings.business_name}</span></div>
        <div className="flex justify-between py-1"><span className="text-slate-500">Mulai Bisnis</span><span className="font-medium">{new Date(settings.start_date).toLocaleDateString("id-ID")}</span></div>
        <div className="flex justify-between py-1"><span className="text-slate-500">Currency</span><span className="font-medium">{settings.currency}</span></div>
      </div>
      <SettingsClient users={users} categories={categories} isAdmin={role === "ADMIN"} />
    </div>
  );
}
