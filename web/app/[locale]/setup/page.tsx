import { LOCAL_WORKSPACE_ID } from "@/lib/supabase/local-adapter"
import { redirect } from "next/navigation"

// 本地模式：默认用户已完成初始化，直接进入工作区
export default function SetupPage() {
  redirect(`/${LOCAL_WORKSPACE_ID}/chat`)
}
