import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Groundcrew Template",
  description: "Starting point for projects built with Groundcrew.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
