import { redirect } from "next/navigation"

export default function HomePage() {
  // 应用入口统一跳转到医疗工作台，不再展示 chatbot-ui 原生落地页
  redirect("/gi")
}
