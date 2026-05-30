import { redirect } from "next/navigation";
import { getSession } from "@/lib/dashboard-auth";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  return <DashboardClient userId={session.userId} displayName={session.displayName} />;
}
