import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthSessionListener } from "@/components/providers/AuthSessionListener";

const GA_MEASUREMENT_ID = "G-LNT6X43H6Z";

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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <ToastProvider>
          <AuthSessionListener />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
