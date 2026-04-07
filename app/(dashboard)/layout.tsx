import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { ActivityTracker } from "@/components/layout/ActivityTracker";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ActivityTracker />
      <Header />
      <Navigation />
      <main className="flex-1 container mx-auto px-6 py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
