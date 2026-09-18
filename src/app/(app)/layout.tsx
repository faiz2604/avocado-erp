import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import QuickEntryBar from "@/components/QuickEntryBar";
import { getSettings } from "@/lib/master";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await getDb();
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const settings = getSettings();
  if (!settings?.setup_completed) redirect("/setup");

  return (
    <div className="flex min-h-screen bg-avocado-50/40">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-4 md:px-6 py-5 pb-20 md:pb-6">{children}</main>
        <QuickEntryBar />
      </div>
    </div>
  );
}
