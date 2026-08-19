"use client"

import { Patient, Visit, api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { Card, Empty, Field, SectionTitle, inputCls, textareaCls } from "./ui"

type TimelineItem = {
  date: string
  kind: string
  item: any
}

const KIND_LABELS: Record<string, string> = {
  labs: "检验",
  imaging: "影像",
  endoscopy: "内镜",
  meds: "用药",
  document: "文书"
}

const KIND_COLORS: Record<string, string> = {
  labs: "bg-blue-500",
  imaging: "bg-purple-500",
  endoscopy: "bg-emerald-500",
  meds: "bg-amber-500",
  document: "bg-slate-500"
}

interface Props {
  patient: Patient | null
  visit: Visit | null
}

export function MaterialsTab({ patient, visit }: Props) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [kind, setKind] = useState("labs")
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!patient || !visit) return
    try {
      const data = await api.get<TimelineItem[]>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/timeline`
      )
      setTimeline(data)
    } catch (e: any) {
      toast.error(e.message || "加载时间线失败")
    }
  }

  useEffect(() => {
    if (patient && visit) {
      load()
    }
  }, [patient?.patient_id, visit?.visit_id])

  const addItem = async () => {
    if (!patient || !visit) return
    setSaving(true)
    try {
      const body = buildBody(kind, form)
      await api.post(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/items/${kind}`,
        body
      )
      toast.success("已新增条目")
      setForm({})
      await load()
    } catch (e: any) {
      toast.error(e.message || "新增失败")
    } finally {
      setSaving(false)
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
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle className="mb-0">时间线</SectionTitle>
          <button
            className="hover:bg-accent rounded-md px-2 py-1 text-xs"
            onClick={load}
          >
            刷新
          </button>
        </div>
        {timeline.length === 0 ? (
          <Empty text="暂无资料，请在右侧新增" />
        ) : (
          <div className="space-y-2">
            {timeline.map((t, i) => (
              <div key={i} className="flex gap-3">
                <div className="text-muted-foreground w-24 shrink-0 text-right text-xs">
                  {t.date || "—"}
                </div>
                <div
                  className={cn(
                    "text-foreground rounded px-1.5 py-0.5 text-xs font-medium",
                    KIND_COLORS[t.kind] || "bg-slate-500"
                  )}
                >
                  {KIND_LABELS[t.kind] || t.kind}
                </div>
                <div className="text-sm">{summarize(t)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>新增资料条目</SectionTitle>
        <Field label="类型">
          <select
            className={inputCls}
            value={kind}
            onChange={e => {
              setKind(e.target.value)
              setForm({})
            }}
          >
            <option value="labs">检验</option>
            <option value="imaging">影像</option>
            <option value="endoscopy">内镜</option>
            <option value="meds">用药</option>
          </select>
        </Field>

        <div className="mt-2 space-y-2">
          {renderForm(kind, form, setForm)}
        </div>

        <button
          className="bg-primary text-primary-foreground mt-3 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={saving}
          onClick={addItem}
        >
          新增
        </button>
      </Card>
    </div>
  )
}

function buildBody(kind: string, form: Record<string, string>) {
  if (kind === "labs") {
    return {
      项目: form["项目"] || "",
      结果: form["结果"] || "",
      单位: form["单位"] || "",
      参考范围: form["参考范围"] || "",
      异常标志: form["异常标志"] || "",
      日期: form["日期"] || "",
      置信度: form["置信度"] ? Number(form["置信度"]) : 1.0
    }
  }
  if (kind === "meds") {
    return {
      药品: form["药品"] || "",
      剂型: form["剂型"] || "",
      剂量: form["剂量"] || "",
      频次: form["频次"] || "",
      途径: form["途径"] || "",
      开始日期: form["开始日期"] || "",
      结束日期: form["结束日期"] || "",
      状态: form["状态"] || "在用",
      备注: form["备注"] || ""
    }
  }
  // imaging / endoscopy
  return {
    类型: form["类型"] || "",
    检查所见: form["检查所见"] || "",
    诊断意见: form["诊断意见"] || "",
    日期: form["日期"] || "",
    置信度: form["置信度"] ? Number(form["置信度"]) : 1.0
  }
}

function renderForm(
  kind: string,
  form: Record<string, string>,
  setForm: (f: Record<string, string>) => void
) {
  const set = (k: string, v: string) => setForm({ ...form, [k]: v })

  if (kind === "labs") {
    return (
      <>
        <Field label="项目 *">
          <input className={inputCls} value={form["项目"] || ""} onChange={e => set("项目", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="结果">
            <input className={inputCls} value={form["结果"] || ""} onChange={e => set("结果", e.target.value)} />
          </Field>
          <Field label="单位">
            <input className={inputCls} value={form["单位"] || ""} onChange={e => set("单位", e.target.value)} />
          </Field>
          <Field label="参考范围">
            <input className={inputCls} value={form["参考范围"] || ""} onChange={e => set("参考范围", e.target.value)} />
          </Field>
          <Field label="异常标志 (↑/↓)">
            <input className={inputCls} value={form["异常标志"] || ""} onChange={e => set("异常标志", e.target.value)} />
          </Field>
          <Field label="日期">
            <input className={inputCls} type="date" value={form["日期"] || ""} onChange={e => set("日期", e.target.value)} />
          </Field>
          <Field label="置信度 (0-1)">
            <input className={inputCls} type="number" step="0.1" value={form["置信度"] || ""} onChange={e => set("置信度", e.target.value)} />
          </Field>
        </div>
      </>
    )
  }

  if (kind === "meds") {
    return (
      <>
        <Field label="药品 *">
          <input className={inputCls} value={form["药品"] || ""} onChange={e => set("药品", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="剂型">
            <input className={inputCls} value={form["剂型"] || ""} onChange={e => set("剂型", e.target.value)} />
          </Field>
          <Field label="剂量">
            <input className={inputCls} value={form["剂量"] || ""} onChange={e => set("剂量", e.target.value)} />
          </Field>
          <Field label="频次">
            <input className={inputCls} value={form["频次"] || ""} onChange={e => set("频次", e.target.value)} />
          </Field>
          <Field label="途径">
            <input className={inputCls} value={form["途径"] || ""} onChange={e => set("途径", e.target.value)} />
          </Field>
          <Field label="开始日期">
            <input className={inputCls} type="date" value={form["开始日期"] || ""} onChange={e => set("开始日期", e.target.value)} />
          </Field>
          <Field label="结束日期">
            <input className={inputCls} type="date" value={form["结束日期"] || ""} onChange={e => set("结束日期", e.target.value)} />
          </Field>
          <Field label="状态">
            <select className={inputCls} value={form["状态"] || "在用"} onChange={e => set("状态", e.target.value)}>
              <option>在用</option>
              <option>已停</option>
            </select>
          </Field>
        </div>
        <Field label="备注">
          <input className={inputCls} value={form["备注"] || ""} onChange={e => set("备注", e.target.value)} />
        </Field>
      </>
    )
  }

  // imaging / endoscopy
  return (
    <>
      <Field label="类型">
        <input className={inputCls} value={form["类型"] || ""} onChange={e => set("类型", e.target.value)} />
      </Field>
      <Field label="检查所见">
        <textarea className={textareaCls} value={form["检查所见"] || ""} onChange={e => set("检查所见", e.target.value)} />
      </Field>
      <Field label="诊断意见">
        <textarea className={textareaCls} value={form["诊断意见"] || ""} onChange={e => set("诊断意见", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="日期">
          <input className={inputCls} type="date" value={form["日期"] || ""} onChange={e => set("日期", e.target.value)} />
        </Field>
        <Field label="置信度 (0-1)">
          <input className={inputCls} type="number" step="0.1" value={form["置信度"] || ""} onChange={e => set("置信度", e.target.value)} />
        </Field>
      </div>
    </>
  )
}

function summarize(t: TimelineItem): string {
  const it = t.item || {}
  switch (t.kind) {
    case "labs":
      return `${it.项目 || ""} ${it.结果 || ""} ${it.单位 || ""}${it.异常标志 ? ` (${it.异常标志})` : ""}`
    case "imaging":
    case "endoscopy":
      return `${it.类型 || ""} ${it.诊断意见 || it.检查所见 || ""}`.slice(0, 60)
    case "meds":
      return `${it.药品 || ""} ${it.剂量 || ""} ${it.频次 || ""} [${it.状态 || ""}]`
    case "document":
      return `${it.doc_type || ""} [${it.status || ""}] ${it.preview || ""}`
    default:
      return JSON.stringify(it).slice(0, 80)
  }
}
