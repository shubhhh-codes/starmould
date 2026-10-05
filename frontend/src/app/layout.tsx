import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { ClientErrorListener, GlobalErrorBoundary } from "@/components/providers/client-error-listener";

export const metadata: Metadata = {
  title: "Star Mould ERP — Precision Tooling & Manufacturing",
  description: "Cloud-native ERP system for mould manufacturing, scanning, printing, and procurement.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen bg-slate-100 text-slate-900"
        suppressHydrationWarning
      >
        <ClientErrorListener />
        <GlobalErrorBoundary>
          <QueryProvider>
            <AuthProvider>
              <PermissionsProvider>{children}</PermissionsProvider>
            </AuthProvider>
          </QueryProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
