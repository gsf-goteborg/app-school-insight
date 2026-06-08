import type { Metadata } from "next";
import { Hanken_Grotesk, Fraunces } from "next/font/google";
import "./globals.css";
import { RoleProvider } from "@/components/role-provider";
import { DemoStoreProvider } from "@/components/demo-store";
import { AppShell } from "@/components/app-shell";

const body = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skolinsikt – datainformerat arbete i grundskolan",
  description:
    "Demoapp för datainformerat arbete med elevresultat, närvaro, elevhälsa, ekonomi och personalplanering. All data är fiktiv.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">
        <RoleProvider>
          <DemoStoreProvider>
            <AppShell>{children}</AppShell>
          </DemoStoreProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
