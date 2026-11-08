import type { Metadata } from "next";
import Cosmos from "../components/cosmos";
import "./globals.css";
import { Poppins } from "next/font/google";

const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // Poppins has no variable version, so list the weights you use
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reviewer Maker",
  description: "Turn your notes into a quiz and flashcards. Files are read in your browser and never uploaded.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={font.variable}>
      <body className="antialiased">
        <Cosmos />
        {children}
      </body>
    </html>
  );
}
