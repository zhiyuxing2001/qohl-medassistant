"use client"

import { RecordEditor } from "@/components/gi/record-editor"
import { useParams, useSearchParams } from "next/navigation"
import { Suspense } from "react"

function NewRecord() {
  const params = useParams<{ pid: string }>()
  const search = useSearchParams()
  return <RecordEditor pid={params.pid} type={search.get("type") || undefined} />
}

export default function NewRecordPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-8 text-center">加载中…</div>}>
      <NewRecord />
    </Suspense>
  )
}
