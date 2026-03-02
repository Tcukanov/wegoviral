import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wegoviral.ai — Instagram Viral Intelligence",
  description: "Find out exactly why your Instagram post didn't go viral. AI-powered analysis, brutal feedback, complete fix brief.",
  metadataBase: new URL("https://wegoviral.ai"),
  openGraph: {
    title: "wegoviral.ai",
    description: "AI-powered Instagram viral intelligence",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-t1 antialiased">
        {children}
      </body>
    </html>
  );
}
