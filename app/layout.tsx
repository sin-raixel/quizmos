import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reviewer Maker",
  description: "Turn your notes into a quiz and flashcards. Files are read in your browser and never uploaded.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
