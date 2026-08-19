import { LOCAL_WORKSPACE_ID } from "@/lib/supabase/local-adapter"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Login"
}

// 本地模式：无需 Supabase 认证，直接使用默认本地用户进入工作区
export default async function Login() {
  redirect(`/${LOCAL_WORKSPACE_ID}/chat`)
}
