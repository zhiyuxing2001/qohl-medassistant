"use client"

import { TemplatesTab } from "@/components/gi/templates-tab"
import { api, Template } from "@/lib/api"
import { IconArrowLeft } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    try {
      setTemplates(await api.get<Template[]>("/api/templates"))
    } catch (e: any) {
      toast.error(e.message || "加载失败")
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <button
          className="hover:bg-accent rounded-md p-1.5"
          onClick={() => router.push("/gi")}
        >
          <IconArrowLeft size={18} />
        </button>
        <h1 className="text-base font-semibold">模板与示例管理</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {ready && <TemplatesTab templates={templates} onRefreshTemplates={load} />}
      </div>
    </div>
  )
}
