"use client"

import { Patient, Suggestion, Visit, api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { Card, Empty, SectionTitle } from "./ui"

interface Props {
  patient: Patient | null
  visit: Visit | null
}

const SECTIONS: { key: string; label: string }[] = [
  { key: "检查建议", label: "检查建议" },
  { key: "治疗建议", label: "治疗建议" },
  { key: "用药调整", label: "用药调整" },
  { key: "随访计划", label: "随访计划" },
  { key: "风险与注意", label: "风险与注意" },
  { key: "资料缺口", label: "资料缺口" }
]

export function SuggestionsTab({ patient, visit }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [generating, setGenerating] = useState(false)

  const load = async () => {
    if (!patient || !visit) return
    try {
      const data = await api.get<Suggestion[]>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/suggestions`
      )
      setSuggestions(data)
    } catch (e: any) {
      toast.error(e.message || "加载诊疗建议失败")
    }
  }

  useEffect(() => {
    setSuggestions([])
    if (patient && visit) load()
  }, [patient?.patient_id, visit?.visit_id])

  const generate = async () => {
    if (!patient || !visit) return
    setGenerating(true)
    try {
      const plan = await api.post<Suggestion>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/suggestions/plan`
      )
      toast.success("已生成诊疗计划")
      setSuggestions(prev => [plan, ...prev])
    } catch (e: any) {
      toast.error(e.message || "生成失败")
    } finally {
      setGenerating(false)
    }
  }

  const setStatus = async (sid: string, status: string) => {
    if (!patient || !visit) return
    try {
      const rec = await api.post<Suggestion>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/suggestions/${sid}/status`,
        { status }
      )
      setSuggestions(prev =>
        prev.map(s => (s.suggestion_id === sid ? rec : s))
      )
    } catch (e: any) {
      toast.error(e.message || "更新状态失败")
    }
  }

  if (!patient || !visit) {
    return (
      <div className="p-4">
        <Empty text="请先选择患者与住院记录" />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle className="mb-0">诊疗建议</SectionTitle>
        <button
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={generating}
          onClick={generate}
        >
          {generating ? "生成中…" : "生成诊疗计划"}
        </button>
      </div>

      {suggestions.length === 0 ? (
        <Empty text="暂无诊疗计划，点击右上角生成" />
      ) : (
        suggestions.map(s => (
          <Card key={s.suggestion_id} className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">
                {s.type || "诊疗计划"}
              </div>
              <span className="text-muted-foreground text-xs">
                {s.created_at?.replace("T", " ").slice(0, 16)}
              </span>
            </div>

            {SECTIONS.map(sec => {
              const items = s.content?.[sec.key] || []
              if (items.length === 0) return null
              return (
                <div key={sec.key} className="mt-2">
                  <div className="text-muted-foreground mb-1 text-xs font-semibold">
                    {sec.label}（{items.length}）
                  </div>
                  <ul className="space-y-1">
                    {items.map((it: string, i: number) => (
                      <li
                        key={i}
                        className="border-border flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <span>{it}</span>
                        <div className="flex shrink-0 gap-1">
                          <button
                            className="hover:bg-accent rounded px-1.5 py-0.5 text-xs text-green-600"
                            onClick={() => setStatus(s.suggestion_id, "采纳")}
                          >
                            采纳
                          </button>
                          <button
                            className="hover:bg-accent rounded px-1.5 py-0.5 text-xs text-red-500"
                            onClick={() => setStatus(s.suggestion_id, "忽略")}
                          >
                            忽略
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </Card>
        ))
      )}
    </div>
  )
}
