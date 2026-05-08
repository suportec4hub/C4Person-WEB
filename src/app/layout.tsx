import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "C4 Person",
  description: "Seu Pilar de Execução Diária",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} antialiased min-h-screen bg-background text-foreground flex`}>
        {/* Futura Sidebar Global irá aqui */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
