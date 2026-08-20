"use client"

import { MaterialsTab } from "@/components/gi/materials-tab"
import { SuggestionsTab } from "@/components/gi/suggestions-tab"
import {
  api,
  DocumentItem,
  GI_API_BASE,
  KIND_LABEL,
  Patient,
  Template,
  TimelineItem,
  Visit
} from "@/lib/api"
import {
  IconArrowLeft,
  IconChevronDown,
  IconFileDownload,
  IconFilePlus,
  IconReportMedical
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Empty, inputCls, SectionTitle } from "./ui"

const PROMINENT_TYPES = ["preop_discussion", "preop_summary"]

function typeName(code: string, templates: Template[]) {
  return templates.find(t => t.code === code)?.name || code
}

export function CaseLibrary({
  pid,
  patients,
  templates,
  onSelectPatient,
  onBack
}: {
  pid: string | null
  patients: Patient[]
  templates: Template[]
  onSelectPatient: (pid: string) => void
  onBack?: () => void
}) {
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [visit, setVisit] = useState<Visit | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [tab, setTab] = useState<"records" | "materials" | "suggestions">("records")
  const [showCreate, setShowCreate] = useState(false)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    if (!pid) {
      setReady(true)
      return
    }
    setReady(false)
    try {
      const p = await api.get<Patient>(`/api/patients/${pid}`)
      setPatient(p)
      const vs = await api.get<Visit[]>(`/api/patients/${pid}/visits`)
      setVisits(vs)
      setVisit(vs[0] || null)
      if (vs[0]) {
        const [ds, tl] = await Promise.all([
          api.get<DocumentItem[]>(`/api/patients/${pid}/visits/${vs[0].visit_id}/documents`),
          api.get<TimelineItem[]>(`/api/patients/${pid}/visits/${vs[0].visit_id}/timeline`)
        ])
        setDocuments(ds)
        setTimeline(tl)
      } else {
        setDocuments([])
        setTimeline([])
      }
    } catch (e: any) {
      toast.error(e.message || "加载失败")
    } finally {
      setReady(true)
    }
  }, [pid])

  useEffect(() => {
    load()
  }, [load])

  const switchVisit = async (vid: string) => {
    if (!pid) return
    const v = visits.find(x => x.visit_id === vid) || null
    setVisit(v)
    if (v) {
      const [ds, tl] = await Promise.all([
        api.get<DocumentItem[]>(`/api/patients/${pid}/visits/${v.visit_id}/documents`),
        api.get<TimelineItem[]>(`/api/patients/${pid}/visits/${v.visit_id}/timeline`)
      ])
      setDocuments(ds)
      setTimeline(tl)
    }
  }

  const newVisit = async () => {
    if (!pid) return
    try {
      const v = await api.post<Visit>(`/api/patients/${pid}/visits`, {
        状态: "住院中",
        入院日期: new Date().toISOString().slice(0, 10)
      })
      const vs = await api.get<Visit[]>(`/api/patients/${pid}/visits`)
      setVisits(vs)
      setVisit(v)
      toast.success("已创建住院记录，请在「患者与住院」中完善信息")
    } catch (e: any) {
      toast.error(e.message || "创建住院记录失败")
    }
  }

  const sortedDocs = useMemo(() => {
    return [...documents].sort((a, b) => {
      if (a.doc_type === "admission" && b.doc_type !== "admission") return -1
      if (b.doc_type === "admission" && a.doc_type !== "admission") return 1
      return (a.doc_date || "").localeCompare(b.doc_date || "")
    })
  }, [documents])

  const activeTemplates = templates.filter(t => t.is_active)
  const hasAdmission = documents.some(d => d.doc_type === "admission")

  const conciseResults = useMemo(() => {
    const labs = timeline.filter(x => x.kind === "labs").map(x => x.item)
    const abnormal = labs.filter(l => l.异常标志).slice(-10)
    const imaging = timeline
      .filter(x => x.kind === "imaging" || x.kind === "endoscopy")
      .slice(-3)
    return { abnormal, imaging }
  }, [timeline])

  const exportAll = () => {
    if (!pid || !visit) return
    window.location.href = `${GI_API_BASE}/api/patients/${pid}/visits/${visit.visit_id}/export-all`
  }

  if (!pid) {
    return <Empty text="请先在「患者列表」选择一位患者" />
  }

  if (!ready) {
    return <div className="text-muted-foreground p-8 text-center">加载中…</div>
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具条 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              className="hover:bg-accent flex items-center gap-1 rounded-md px-2 py-1.5 text-sm"
              onClick={onBack}
            >
              <IconArrowLeft size={16} />
              返回患者列表
            </button>
          )}
          <select
            className={inputCls + " w-auto"}
            value={pid}
            onChange={e => onSelectPatient(e.target.value)}
          >
            {patients.map(p => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.脱敏编号 || p.patient_id}
              </option>
            ))}
          </select>
          {visits.length > 0 && (
            <select
              className={inputCls + " w-auto"}
              value={visit?.visit_id || ""}
              onChange={e => switchVisit(e.target.value)}
            >
              {visits.map(v => (
                <option key={v.visit_id} value={v.visit_id}>
                  {v.住院号 || v.visit_id}（{v.入院日期 || "?"}）
                </option>
              ))}
            </select>
          )}
          <button
            onClick={newVisit}
            className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
          >
            新建住院
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border">
            {(["records", "materials", "suggestions"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  tab === t
                    ? "bg-accent rounded-md px-3 py-1.5 text-sm"
                    : "hover:bg-accent rounded-md px-3 py-1.5 text-sm"
                }
              >
                {t === "records" ? "病历" : t === "materials" ? "资料库" : "诊疗建议"}
              </button>
            ))}
          </div>
          <button
            onClick={exportAll}
            className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm"
            disabled={!visit}
          >
            <IconFileDownload size={16} />
            完整病历导出
          </button>
        </div>
      </div>

      {tab === "records" && (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col border-r p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
                  onClick={() => setShowCreate(v => !v)}
                >
                  <IconFilePlus size={16} />
                  创建病历
                  <IconChevronDown size={14} />
                </button>
                {showCreate && (
                  <div className="border-border bg-background absolute z-20 mt-1 w-56 rounded-md border p-1 shadow-lg">
                    {activeTemplates.map(t => (
                      <button
                        key={t.code}
                        className="hover:bg-accent block w-full rounded px-2 py-1.5 text-left text-sm"
                        onClick={() => {
                          setShowCreate(false)
                          router.push(`/gi/${pid}/records/new?type=${t.code}`)
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {PROMINENT_TYPES.map(code => {
                const t = activeTemplates.find(x => x.code === code)
                if (!t) return null
                return (
                  <button
                    key={code}
                    className="hover:bg-accent rounded-md border px-3 py-2 text-sm"
                    onClick={() => router.push(`/gi/${pid}/records/new?type=${code}`)}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>

            {!hasAdmission && (
              <button
                onClick={() => router.push(`/gi/${pid}/records/new?type=admission`)}
                className="border-border hover:bg-accent mb-3 flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm"
              >
                <IconReportMedical size={18} />
                尚无入院记录，点击创建入院记录
              </button>
            )}

            <div className="min-h-0 grow overflow-y-auto">
              {sortedDocs.length === 0 ? (
                <Empty text="暂无病历" />
              ) : (
                sortedDocs.map(d => (
                  <button
                    key={d.doc_id}
                    onClick={() => router.push(`/gi/${pid}/records/${d.doc_id}`)}
                    className="border-border hover:bg-accent mb-2 flex w-full items-center justify-between rounded-lg border p-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {typeName(d.doc_type, templates)}
                        </span>
                        <span
                          className={
                            d.status === "已确认"
                              ? "bg-primary/20 text-primary rounded px-1.5 py-0.5 text-xs"
                              : "bg-amber-500/20 text-amber-500 rounded px-1.5 py-0.5 text-xs"
                          }
                        >
                          {d.status}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 truncate text-xs">
                        {d.doc_date} · {d.summary || d.preview || "（无摘要）"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <aside className="w-80 shrink-0 overflow-y-auto p-4">
            <SectionTitle>精简检验检查</SectionTitle>
            {conciseResults.abnormal.length === 0 &&
            conciseResults.imaging.length === 0 ? (
              <Empty text="暂无异常结果" />
            ) : (
              <div className="space-y-3">
                {conciseResults.abnormal.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs font-medium">
                      异常检验
                    </div>
                    {conciseResults.abnormal.map((l, i) => (
                      <div key={i} className="text-xs leading-5">
                        <span className="font-medium">{l.项目}</span>{" "}
                        <span className={l.异常标志 === "↑" ? "text-red-400" : "text-blue-400"}>
                          {l.结果} {l.单位} {l.异常标志}
                        </span>{" "}
                        <span className="text-muted-foreground">({l.参考范围})</span>
                      </div>
                    ))}
                  </div>
                )}
                {conciseResults.imaging.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs font-medium">
                      影像/内镜
                    </div>
                    {conciseResults.imaging.map((it, i) => (
                      <div key={i} className="text-xs leading-5">
                        <span className="font-medium">
                          {it.item.类型 || KIND_LABEL[it.kind]}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          {String(it.item.诊断意见 || it.item.检查所见 || "").slice(0, 60)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === "materials" && (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <MaterialsTab patient={patient} visit={visit} />
        </div>
      )}
      {tab === "suggestions" && (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <SuggestionsTab patient={patient} visit={visit} />
        </div>
      )}
    </div>
  )
}
