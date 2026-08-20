"use client"

import { Workbench } from "@/components/gi/workbench"
import { Suspense } from "react"

export default function GIHome() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-8 text-center">加载中…</div>}>
      <Workbench />
    </Suspense>
  )
}
