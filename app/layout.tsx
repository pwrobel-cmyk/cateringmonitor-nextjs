import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { CountryProvider } from "@/contexts/CountryContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CateringMonitor — monitoring rynku cateringowego",
  description: "Portal do monitorowania cen, rabatów i trendów na rynku cateringowym",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f8fafc]">
        <SupabaseProvider>
          <QueryProvider>
            <AuthProvider>
              <CountryProvider>
                <Toaster />
                {children}
              </CountryProvider>
            </AuthProvider>
          </QueryProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
