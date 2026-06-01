import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetPulse 5G — QoS Diagnostics Engine",
  description: "Enterprise-grade 5G Quality of Service diagnostics. Measure download speed, upload speed, latency, jitter, packet loss, bufferbloat stress index, and 3GPP QoS classification in real-time.",
  keywords: "5G, QoS, speed test, latency, jitter, packet loss, bufferbloat, Open5GS, network diagnostics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="antialiased"
        style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
