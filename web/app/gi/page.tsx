"use client"

import { DocumentsTab } from "@/components/gi/documents-tab"
import { MaterialsTab } from "@/components/gi/materials-tab"
import { PatientsPanel } from "@/components/gi/patients-panel"
import { SuggestionsTab } from "@/components/gi/suggestions-tab"
import { TemplatesTab } from "@/components/gi/templates-tab"
import { VisitTab } from "@/components/gi/visit-tab"
import { api, Patient, Template, Visit } from "@/lib/api"
import { IconStethoscope } from "@tabler/icons-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

type TabKey = "visit" | "materials" | "documents" | "suggestions" | "templates"

const TABS: { key: TabKey; label: string }[] = [
  { key: "visit", label: "患者与住院" },
  { key: "materials", label: "资料库" },
  { key: "documents", label: "文书时间线" },
  { key: "suggestions", label: "诊疗建议" },
  { key: "templates", label: "模板与示例" }
]

export default function GIWorkbench() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [tab, setTab] = useState<TabKey>("visit")
  const [ready, setReady] = useState(false)

  const refreshPatients = useCallback(async () => {
    const ps = await api.get<Patient[]>("/api/patients")
    setPatients(ps)
    return ps
  }, [])

  const refreshTemplates = useCallback(async () => {
    const ts = await api.get<Template[]>("/api/templates")
    setTemplates(ts)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([refreshPatients(), refreshTemplates()])
      } catch (e: any) {
        toast.error(`后端连接失败：${e.message || e}（请确认 8100 端口后端已启动）`)
      } finally {
        setReady(true)
      }
    })()
  }, [refreshPatients, refreshTemplates])

  const loadVisits = useCallback(async (p: Patient) => {
    const vs = await api.get<Visit[]>(`/api/patients/${p.patient_id}/visits`)
    setVisits(vs)
    setSelectedVisit(vs.length ? vs[0] : null)
  }, [])

  const selectPatient = async (p: Patient) => {
    setSelectedPatient(p)
    try {
      await loadVisits(p)
    } catch (e: any) {
      toast.error(e.message || "加载住院记录失败")
    }
  }

  const newVisit = async () => {
    if (!selectedPatient) return
    try {
      const v = await api.post<Visit>(
        `/api/patients/${selectedPatient.patient_id}/visits`,
        { 状态: "住院中", 入院日期: new Date().toISOString().slice(0, 10) }
      )
      await loadVisits(selectedPatient)
      setSelectedVisit(v)
      toast.success("已创建住院记录，请在「患者与住院」页完善信息")
    } catch (e: any) {
      toast.error(e.message || "创建住院记录失败")
    }
  }

  const refreshTemplatesAndGo = async () => {
    await refreshTemplates()
    setTab("templates")
  }

  return (
    <div className="flex h-full">
      {/* 左侧：患者与住院选择 */}
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <PatientsPanel
          patients={patients}
          selectedPatient={selectedPatient}
          visits={visits}
          selectedVisit={selectedVisit}
          onSelectPatient={selectPatient}
          onSelectVisit={setSelectedVisit}
          onRefreshPatients={async () => {
            const ps = await refreshPatients()
            if (selectedPatient) {
              const cur = ps.find(p => p.patient_id === selectedPatient.patient_id)
              if (cur) setSelectedPatient(cur)
            }
          }}
          onNewVisit={newVisit}
        />
      </aside>

      {/* 右侧：工作区 */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <IconStethoscope size={18} />
            GI 医疗工作区
            <span className="text-muted-foreground text-xs font-normal">
              {selectedPatient ? `患者：${selectedPatient.脱敏编号 || selectedPatient.patient_id}` : "未选择患者"}
              {selectedVisit ? ` ｜ 住院：${selectedVisit.住院号 || selectedVisit.visit_id}` : ""}
            </span>
          </div>
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  tab === t.key
                    ? "bg-accent rounded-md px-3 py-1.5 text-sm"
                    : "hover:bg-accent rounded-md px-3 py-1.5 text-sm"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 grow overflow-auto p-4">
          {!ready ? (
            <div className="text-muted-foreground p-8 text-center">加载中…</div>
          ) : (
            <>
              {tab === "visit" && (
                <VisitTab
                  patient={selectedPatient}
                  visit={selectedVisit}
                  onPatientUpdated={p => setSelectedPatient(p)}
                  onVisitUpdated={v => setSelectedVisit(v)}
                  onVisitDeleted={async () => {
                    setSelectedVisit(null)
                    if (selectedPatient) await loadVisits(selectedPatient)
                  }}
                />
              )}
              {tab === "materials" && (
                <MaterialsTab patient={selectedPatient} visit={selectedVisit} />
              )}
              {tab === "documents" && (
                <DocumentsTab
                  patient={selectedPatient}
                  visit={selectedVisit}
                  templates={templates}
                />
              )}
              {tab === "suggestions" && (
                <SuggestionsTab patient={selectedPatient} visit={selectedVisit} />
              )}
              {tab === "templates" && (
                <TemplatesTab
                  templates={templates}
                  onRefreshTemplates={refreshTemplatesAndGo}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
