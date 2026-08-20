"use client"

import { RecordEditor } from "@/components/gi/record-editor"
import { useParams } from "next/navigation"

export default function EditRecordPage() {
  const params = useParams<{ pid: string; docId: string }>()
  return <RecordEditor pid={params.pid} docId={params.docId} />
}
