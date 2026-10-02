import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { DialogHost } from "@/components/dialogs";

const sora = Sora({ subsets: ["latin"], variable: "--font-app" });

export const metadata: Metadata = {
  title: "Task Flow",
  description: "Project tracking for creative teams",
};

// Applies the saved theme before first paint (light by default).
const themeScript = `try{if(localStorage.getItem('ff-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        <DialogHost />
      </body>
    </html>
  );
}
