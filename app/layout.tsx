import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthSessionListener } from "@/components/providers/AuthSessionListener";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Asambleas App",
  description: "Aplicación SaaS para gestión de asambleas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ToastProvider>
          <AuthSessionListener />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
