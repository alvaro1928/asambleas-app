import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthSessionListener } from "@/components/providers/AuthSessionListener";

const GA_MEASUREMENT_ID = "G-LNT6X43H6Z";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? (process.env.NEXT_PUBLIC_SITE_URL.startsWith("http")
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : `https://${process.env.NEXT_PUBLIC_SITE_URL}`)
  : "https://asambleas.online";

const DEFAULT_TITLE = "Votaciones de Asambleas Online | Plataforma Legal Ley 675";
const DEFAULT_DESCRIPTION =
  "La plataforma líder en Colombia para votaciones de asambleas virtuales. Quórum en tiempo real, actas automáticas y notificaciones por WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | Asambleas Online",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: ["asambleas virtuales", "votaciones online", "propiedad horizontal", "Ley 675", "actas de asamblea", "quórum", "Colombia"],
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: SITE_URL,
    siteName: "Asambleas Online",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Asambleas Online - Votaciones Ley 675",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/logo.png"],
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
