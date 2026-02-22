import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "Cachu Kiosco",
  description: "Kiosco de pedidos de Cachu Burger",
  applicationName: "Cachu Kiosco",
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
