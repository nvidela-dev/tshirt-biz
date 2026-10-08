import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Press Studio — T-shirt Creator",
  description: "Create, position, and export print-ready T-shirt artwork.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ClerkProvider appearance={{
          theme: dark,
          variables: {
            colorBackground: '#0a0a0a', colorForeground: '#ededed',
            colorPrimary: '#ededed', colorPrimaryForeground: '#000000',
            colorNeutral: '#ffffff', colorBorder: '#333333',
            colorInput: '#111111', colorInputForeground: '#ededed',
            colorMuted: '#171717', colorMutedForeground: '#888888',
            colorRing: '#888888', colorModalBackdrop: 'rgba(0,0,0,0.8)',
            colorSuccess: '#ededed', colorWarning: '#aaaaaa', colorDanger: '#ededed',
            borderRadius: '0', fontFamily: 'var(--font-geist-sans), sans-serif',
          },
          elements: { cardBox: { border: '1px solid #333', boxShadow: 'none' },
            footer: { background: '#0a0a0a', backgroundImage: 'none' } },
        }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}