import type { Metadata, Viewport } from "next";
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
  title: "Laundry",
  description: "See if the roof washing machines are free, queue for your turn and get pinged when it's yours.",
  appleWebApp: { capable: true, title: "Laundry", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <footer className="mx-auto mt-auto w-full max-w-xl px-4 pb-8 pt-4 text-xs text-muted">
          <p>
            Made with love by{" "}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://github.com/Ekam-Bitt">
              Ekam
            </a>
          </p>
          <p className="mt-1">
            Open for contributions or issues on{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="https://github.com/Ekam-Bitt/washing-machine"
            >
              GitHub
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
