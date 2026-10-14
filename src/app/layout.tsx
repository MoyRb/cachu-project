import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "CACHUBURGER",
  description: "CACHUBURGER — pedidos en línea",
  applicationName: "CACHUBURGER",
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
