import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Shield,
  Cpu,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "EPBCO Solutions",
  description:
    "EPBCO Solutions — Automatización y soluciones digitales. Conoce nuestro producto para asambleas y votaciones online.",
};

const TEL = "573143104977";
const EMAIL = "contactanos@epbco.cloud";

export default function EPBCOPage() {
  return (
    <main
      className="min-h-screen text-slate-100"
      style={{ backgroundColor: "#0B0E14" }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        {/* Hero empresa */}
        <header className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 bg-slate-800 border border-white/10">
            <Building2 className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            EPBCO Solutions
          </h1>
          <p className="mt-4 text-xl text-slate-400 max-w-2xl mx-auto">
            Automatización y soluciones digitales para empresas y comunidades.
          </p>
        </header>

        {/* Qué hacemos */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-6 h-6 text-indigo-400" />
            <h2 className="text-2xl font-semibold text-white">
              A qué nos dedicamos
            </h2>
          </div>
          <p className="text-slate-300 leading-relaxed mb-4">
            Desarrollamos soluciones de software que automatizan procesos
            operativos y de gobierno: votaciones, actas, gestión de asambleas y
            cumplimiento normativo. Nuestro enfoque es entregar productos
            usables, seguros y alineados con la ley (por ejemplo, Ley 675 en
            Colombia).
          </p>
          <p className="text-slate-300 leading-relaxed">
            Trabajamos con administradores de propiedad horizontal, consejos de
            administración y empresas que buscan digitalizar y auditar sus
            procesos de forma confiable.
          </p>
        </section>

        {/* Producto: esta aplicación */}
        <section className="mb-14 rounded-3xl border border-white/10 bg-slate-800/40 p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Nuestro producto
          </h2>
          <p className="text-slate-300 leading-relaxed mb-6">
            <strong className="text-white">Asambleas App</strong> (VOTA TECH) es
            nuestra plataforma de votaciones online para asambleas de propiedad
            horizontal: quórum en tiempo real, actas, auditoría y cumplimiento
            Ley 675. Si quieres conocer la aplicación, precios y empezar a
            usarla, entra al sitio del producto.
          </p>
          <Link href="/">
            <Button
              size="lg"
              className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              Ir al sitio del producto
              <ExternalLink className="w-4 h-4" />
            </Button>
          </Link>
        </section>

        {/* Contacto */}
        <section className="mb-14">
          <h2 className="text-2xl font-semibold text-white mb-6">Contacto</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            <a
              href={`tel:${TEL}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/40 px-5 py-4 text-slate-200 hover:text-white hover:bg-slate-700/40 transition-colors"
            >
              <Phone className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>57 314 310 4977</span>
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/40 px-5 py-4 text-slate-200 hover:text-white hover:bg-slate-700/40 transition-colors"
            >
              <Mail className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>{EMAIL}</span>
            </a>
          </div>
        </section>

        {/* Footer legal */}
        <footer className="pt-8 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <Link
              href="/politica-privacidad"
              className="hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <Shield className="w-4 h-4" />
              Política de Privacidad y Tratamiento de Datos
            </Link>
            <Link href="/" className="hover:text-white transition-colors">
              Producto: Asambleas App
            </Link>
          </div>
          <p className="mt-4 text-center text-slate-500 text-sm">
            © {new Date().getFullYear()} EPBCO Solutions. Todos los derechos
            reservados.
          </p>
        </footer>
      </div>
    </main>
  );
}
