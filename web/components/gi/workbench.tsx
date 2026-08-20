"use client"

import { CaseLibrary } from "@/components/gi/case-library"
import { CasesLibrary } from "@/components/gi/cases-library"
import { PatientList } from "@/components/gi/patient-list"
import { PathwaysLibrary } from "@/components/gi/pathways-library"
import { Module, Sidebar } from "@/components/gi/sidebar"
import { TemplatesTab } from "@/components/gi/templates-tab"
import { api, Patient, Template } from "@/lib/api"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export function Workbench() {
  const router = useRouter()
  const search = useSearchParams()
  const [module, setModule] = useState<Module>("patients")
  const [patients, setPatients] = useState<Patient[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedPid, setSelectedPid] = useState<string | null>(search.get("pid"))

  const loadPatients = useCallback(async () => {
    try {
      setPatients(await api.get<Patient[]>("/api/patients"))
    } catch (e: any) {
      toast.error(`后端连接失败：${e.message || e}`)
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    try {
      setTemplates(await api.get<Template[]>("/api/templates"))
    } catch (e: any) {
      toast.error(e.message || "模板加载失败")
    }
  }, [])

  useEffect(() => {
    loadPatients()
    loadTemplates()
  }, [loadPatients, loadTemplates])

  const selectPatient = (pid: string) => {
    setSelectedPid(pid)
    setModule("patients")
    router.replace(`/gi?pid=${pid}`)
  }

  const backToPatients = () => {
    setSelectedPid(null)
    router.replace("/gi")
  }

  const selectedPatient = patients.find(p => p.patient_id === selectedPid)

  return (
    <div className="flex h-full">
      <Sidebar
        active={module}
        onSelect={setModule}
        patientLabel={
          selectedPatient
            ? selectedPatient.姓名 || selectedPid || ""
            : undefined
        }
      />
      <main className="min-w-0 flex-1 overflow-auto">
        {module === "patients" &&
          (selectedPid ? (
            <CaseLibrary
              pid={selectedPid}
              patients={patients}
              templates={templates}
              onSelectPatient={selectPatient}
              onBack={backToPatients}
            />
          ) : (
            <PatientList
              patients={patients}
              onSelectPatient={p => selectPatient(p.patient_id)}
              onRefreshPatients={loadPatients}
            />
          ))}

        {module === "cases" && <CasesLibrary />}

        {module === "pathways" && <PathwaysLibrary />}

        {module === "templates" && (
          <div className="p-6">
            <h2 className="mb-4 text-lg font-semibold">病历模板</h2>
            <TemplatesTab templates={templates} onRefreshTemplates={loadTemplates} />
          </div>
        )}
      </main>
    </div>
  )
}
