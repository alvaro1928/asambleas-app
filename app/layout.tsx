import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthSessionListener } from "@/components/providers/AuthSessionListener";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Simulador de Votaciones | Asambleas Virtuales",
    template: "%s | Asambleas Online",
  },
  description: "Plataforma líder en votaciones online para asambleas de propiedad horizontal. Simulador de votaciones, actas, quórum en tiempo real y cumplimiento Ley 675.",
  keywords: ["asambleas virtuales", "votaciones online", "propiedad horizontal", "Ley 675", "actas de asamblea", "quórum"],
  openGraph: {
    type: "website",
    locale: "es_CO",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-w-0 overflow-x-hidden`}>
        <ToastProvider>
          <AuthSessionListener />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
