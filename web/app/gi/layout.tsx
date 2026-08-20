import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/utility/providers"
import { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { ReactNode } from "react"
import "../[locale]/globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "QoHL医疗助手",
  description: "QoHL 临床医生助手"
}

export const viewport: Viewport = {
  themeColor: "#ffffff"
}

export default function GILayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers attribute="class" defaultTheme="light">
          <Toaster richColors position="top-center" duration={3000} />
          <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
