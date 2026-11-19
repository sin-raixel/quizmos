import type { Metadata } from "next";
import Script from "next/script";
import Cosmos from "../components/cosmos";
import "./globals.css";
import { Poppins } from "next/font/google";

const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // Poppins has no variable version, so list the weights you use
  variable: "--font-space",
  display: "swap",
});

// Runs before the page paints, so there is no flash of the wrong theme.
// A saved choice wins; otherwise follow the device setting.
const THEME_INIT = `(function(){var t;try{t=localStorage.getItem("quizmos-theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t})()`;

export const metadata: Metadata = {
  metadataBase: new URL("https://project-quizmos.vercel.app"),
  title: "Quizmos: turn your notes into a quiz",
  description: "Turn your notes into a quiz and flashcards. Files are read in your browser and never uploaded.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Quizmos", url: "/" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={font.variable} suppressHydrationWarning>
      <body className="antialiased">
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>
        <Cosmos />
        {children}
      </body>
    </html>
  );
}
