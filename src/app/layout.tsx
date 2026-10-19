import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { ClientErrorListener, GlobalErrorBoundary } from "@/components/providers/client-error-listener";
import { ToastContainer } from "@/components/ui/toast-container";

import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Star Mould ERP — Precision Tooling & Manufacturing",
  description: "Cloud-native ERP system for mould manufacturing, scanning, printing, and procurement.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialUser = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("sm_session")?.value;
    if (token) {
      initialUser = verifySessionToken(token);
    }
  } catch {
    // Graceful fallback during static generation or build-time prerender
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen bg-slate-100 text-slate-900"
        suppressHydrationWarning
      >
        <ClientErrorListener />
        <GlobalErrorBoundary>
          <QueryProvider>
            <AuthProvider initialUser={initialUser}>
              <PermissionsProvider initialUser={initialUser}>{children}</PermissionsProvider>
              <ToastContainer />
            </AuthProvider>
          </QueryProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
