import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sistema Multi-Junta de Gestión Integral", template: "%s · Multi-Junta" },
  description: "Gestión integral para juntas parroquiales y comunitarias del Ecuador",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
