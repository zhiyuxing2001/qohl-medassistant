"use client"

import { Patient, Visit, api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { IconPlus, IconStethoscope, IconX } from "@tabler/icons-react"
import { toast } from "sonner"
import { useState } from "react"
import { Empty, inputCls } from "./ui"

interface Props {
  patients: Patient[]
  selectedPatient: Patient | null
  visits: Visit[]
  selectedVisit: Visit | null
  onSelectPatient: (p: Patient) => void
  onSelectVisit: (v: Visit) => void
  onRefreshPatients: () => void
  onNewVisit: () => void
}

export function PatientsPanel({
  patients,
  selectedPatient,
  visits,
  selectedVisit,
  onSelectPatient,
  onSelectVisit,
  onRefreshPatients,
  onNewVisit
}: Props) {
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const createPatient = async () => {
    setSaving(true)
    try {
      const p = await api.post<Patient>("/api/patients", {
        脱敏编号: form["脱敏编号"] || "",
        性别: form["性别"] || null,
        年龄: form["年龄"] ? Number(form["年龄"]) : null,
        体重: form["体重"] ? Number(form["体重"]) : null,
        过敏史: form["过敏史"] || "",
        既往史: form["既往史"] || "",
        家族史: form["家族史"] || "",
        备注: form["备注"] || ""
      })
      setShowNew(false)
      setForm({})
      toast.success("已创建患者")
      await onRefreshPatients()
      onSelectPatient(p)
    } catch (e: any) {
      toast.error(e.message || "创建失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <IconStethoscope size={18} />
          患者列表
        </div>
        <button
          className="hover:bg-accent rounded p-1"
          onClick={() => setShowNew(v => !v)}
          title="新建患者"
        >
          <IconPlus size={18} />
        </button>
      </div>

      {showNew && (
        <div className="space-y-2 border-b p-3">
          <div className="text-xs font-medium">新建患者</div>
          <input
            className={inputCls}
            placeholder="脱敏编号（必填，如 P001）"
            value={form["脱敏编号"] || ""}
            onChange={e => setForm({ ...form, 脱敏编号: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="性别"
              value={form["性别"] || ""}
              onChange={e => setForm({ ...form, 性别: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="年龄"
              type="number"
              value={form["年龄"] || ""}
              onChange={e => setForm({ ...form, 年龄: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="体重"
              type="number"
              value={form["体重"] || ""}
              onChange={e => setForm({ ...form, 体重: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="bg-primary text-primary-foreground flex-1 rounded-md px-2 py-1.5 text-xs"
              disabled={saving}
              onClick={createPatient}
            >
              保存
            </button>
            <button
              className="hover:bg-accent rounded-md px-2 py-1.5 text-xs"
              onClick={() => setShowNew(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="grow overflow-y-auto p-2">
        {patients.length === 0 ? (
          <Empty text="暂无患者" />
        ) : (
          patients.map(p => (
            <div key={p.patient_id}>
              <button
                className={cn(
                  "hover:bg-accent w-full rounded-md px-2 py-2 text-left text-sm",
                  selectedPatient?.patient_id === p.patient_id && "bg-accent"
                )}
                onClick={() => onSelectPatient(p)}
              >
                <div className="font-medium">
                  {p.脱敏编号 || p.patient_id}
                </div>
                <div className="text-muted-foreground text-xs">
                  {[p.性别, p.年龄 ? `${p.年龄}岁` : ""]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </button>

              {selectedPatient?.patient_id === p.patient_id && (
                <div className="mb-1 ml-3 border-l pl-2">
                  <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                    <span>住院记录</span>
                    <button
                      className="hover:bg-accent rounded p-0.5"
                      onClick={onNewVisit}
                      title="新建住院"
                    >
                      <IconPlus size={14} />
                    </button>
                  </div>
                  {visits.length === 0 ? (
                    <div className="text-muted-foreground px-1 text-xs">
                      暂无
                    </div>
                  ) : (
                    visits.map(v => (
                      <button
                        key={v.visit_id}
                        className={cn(
                          "hover:bg-accent block w-full rounded px-1.5 py-1 text-left text-xs",
                          selectedVisit?.visit_id === v.visit_id &&
                            "bg-accent"
                        )}
                        onClick={() => onSelectVisit(v)}
                      >
                        <span className="font-medium">
                          {v.住院号 || v.visit_id}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          {v.入院日期 || ""} · {v.状态}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
