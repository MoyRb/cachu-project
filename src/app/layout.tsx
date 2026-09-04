import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "Cachuburguer",
  description: "Cachuburguer — pedidos en línea",
  applicationName: "Cachuburguer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body data-theme="cachuburger" className="app-bg antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
