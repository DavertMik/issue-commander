import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppToaster } from "@/components/app-toaster";

// Applies the saved theme to <html> before first paint (no flash). Kept in sync with
// lib/themes.ts — `d` = dark themes (get the `.dark` class), `l` = light.
const THEME_INIT = `(function(){try{
var M={commander:'d',monokai:'d',dracula:'d',nord:'d','solarized-dark':'d','tokyo-night':'d',paper:'l','solarized-light':'l','github-light':'l','one-light':'l','rose-pine-dawn':'l','dracula-light':'l'};
var id=localStorage.getItem('total-issues:theme');if(!id||!M[id])id='commander';
var e=document.documentElement,dark=M[id]==='d';
e.setAttribute('data-theme',id);e.classList.toggle('dark',dark);e.style.colorScheme=dark?'dark':'light';
}catch(x){}})();`;

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Issue Commander",
  description: "A Total Commander for GitHub issues",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <Providers>{children}</Providers>
        <AppToaster />
      </body>
    </html>
  );
}
