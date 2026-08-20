"use client"

import { PatientDetail } from "@/components/gi/patient-detail"
import { useParams } from "next/navigation"

export default function PatientPage() {
  const params = useParams<{ pid: string }>()
  return <PatientDetail pid={params.pid} />
}
