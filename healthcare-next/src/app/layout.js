import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { ToastProvider } from "@/context/ToastContext";
import { NotificationProvider } from "@/context/NotificationContext";
import Navbar from "@/components/Navbar";
import ToastStack from "@/components/ToastStack";
import RegisterModalHost from "@/components/RegisterModalHost";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "HealthChain — Your Health Data. Your Ownership.",
  description: "Secure decentralized healthcare powered by blockchain technology.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WalletProvider>
          <ToastProvider>
            <NotificationProvider>
              <Navbar />
              <main className="flex-1">{children}</main>
              <ToastStack />
              <RegisterModalHost />
            </NotificationProvider>
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
