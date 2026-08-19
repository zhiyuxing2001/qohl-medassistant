"use client"

import { ChatbotUISVG } from "@/components/icons/chatbotui-svg"
import { LOCAL_WORKSPACE_ID } from "@/lib/supabase/local-adapter"
import { IconArrowRight } from "@tabler/icons-react"
import { useTheme } from "next-themes"
import Link from "next/link"

export default function HomePage() {
  const { theme } = useTheme()

  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div>
        <ChatbotUISVG theme={theme === "dark" ? "dark" : "light"} scale={0.3} />
      </div>

      <div className="mt-2 text-4xl font-bold">消化科临床助手</div>

      <Link
        className="mt-4 flex w-[200px] items-center justify-center rounded-md bg-blue-500 p-2 font-semibold"
        href={`/${LOCAL_WORKSPACE_ID}/chat`}
      >
        开始使用
        <IconArrowRight className="ml-1" size={20} />
      </Link>
    </div>
  )
}
