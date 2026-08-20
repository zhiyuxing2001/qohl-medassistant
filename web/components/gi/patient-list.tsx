"use client"

import { api, Patient, Visit } from "@/lib/api"
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Empty, Field, inputCls, textareaCls } from "./ui"

export function PatientList({
  patients,
  onSelectPatient,
  onRefreshPatients
}: {
  patients: Patient[]
  onSelectPatient: (p: Patient) => void
  onRefreshPatients: () => void
}) {
  const [kw, setKw] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [diagnoses, setDiagnoses] = useState<string[]>([])
  const [shortcuts, setShortcuts] = useState<string[]>([])
  const [newShortcut, setNewShortcut] = useState("")
  const [saving, setSaving] = useState(false)

  const filtered = patients.filter(p =>
    !kw ||
    (p.姓名 || "").toLowerCase().includes(kw.toLowerCase()) ||
    (p.病案号 || "").toLowerCase().includes(kw.toLowerCase())
  )

  useEffect(() => {
    api.get<string[]>("/api/shortcuts").then(setShortcuts).catch(() => {})
  }, [])

  const addDiagnosis = (d: string) => {
    const t = d.trim()
    if (t && !diagnoses.includes(t)) setDiagnoses(prev => [...prev, t])
  }

  const saveShortcuts = async (items: string[]) => {
    try {
      const saved = await api.put<string[]>("/api/shortcuts", { 诊断: items })
      setShortcuts(saved)
    } catch (e: any) {
      toast.error(e.message || "快捷键保存失败")
    }
  }

  const addShortcut = () => {
    const t = newShortcut.trim()
    if (!t) return
    if (!shortcuts.includes(t)) saveShortcuts([...shortcuts, t])
    setNewShortcut("")
  }

  const removeShortcut = (s: string) => {
    saveShortcuts(shortcuts.filter(x => x !== s))
  }

  const createPatient = async () => {
    setSaving(true)
    try {
      const p = await api.post<Patient>("/api/patients", {
        姓名: form["姓名"] || "",
        病案号: form["病案号"] || "",
        性别: form["性别"] || null,
        年龄: form["年龄"] ? Number(form["年龄"]) : null,
        体重: form["体重"] ? Number(form["体重"]) : null,
        过敏史: form["过敏史"] || "",
        既往史: form["既往史"] || "",
        家族史: form["家族史"] || "",
        备注: form["备注"] || ""
      })
      // 自动创建首次住院，写入初步诊断
      if (diagnoses.length > 0) {
        await api.post<Visit>(`/api/patients/${p.patient_id}/visits`, {
          状态: "住院中",
          入院日期: new Date().toISOString().slice(0, 10),
          入院诊断: diagnoses.join("\n")
        })
      }
      toast.success(diagnoses.length > 0 ? "已创建患者与住院记录" : "已创建患者")
      setShowNew(false)
      setForm({})
      setDiagnoses([])
      onRefreshPatients()
      onSelectPatient(p)
    } catch (e: any) {
      toast.error(e.message || "创建失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">患者列表</h2>
        <button
          onClick={() => setShowNew(v => !v)}
          className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
        >
          <IconPlus size={16} />
          添加患者
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <IconSearch
            size={16}
            className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            className={inputCls + " pl-9"}
            placeholder="按姓名或病案号搜索患者…"
            value={kw}
            onChange={e => setKw(e.target.value)}
          />
        </div>
      </div>

      {showNew && (
        <div className="border-border mb-4 space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">新建患者</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="姓名 *">
              <input
                className={inputCls}
                placeholder="患者姓名"
                value={form["姓名"] || ""}
                onChange={e => setForm({ ...form, 姓名: e.target.value })}
              />
            </Field>
            <Field label="病案号">
              <input
                className={inputCls}
                placeholder="病案号"
                value={form["病案号"] || ""}
                onChange={e => setForm({ ...form, 病案号: e.target.value })}
              />
            </Field>
            <Field label="性别">
              <input
                className={inputCls}
                placeholder="男 / 女"
                value={form["性别"] || ""}
                onChange={e => setForm({ ...form, 性别: e.target.value })}
              />
            </Field>
            <Field label="年龄">
              <input
                className={inputCls}
                type="number"
                value={form["年龄"] || ""}
                onChange={e => setForm({ ...form, 年龄: e.target.value })}
              />
            </Field>
            <Field label="体重 (kg)">
              <input
                className={inputCls}
                type="number"
                value={form["体重"] || ""}
                onChange={e => setForm({ ...form, 体重: e.target.value })}
              />
            </Field>
            <Field label="过敏史" className="sm:col-span-2">
              <input
                className={inputCls}
                value={form["过敏史"] || ""}
                onChange={e => setForm({ ...form, 过敏史: e.target.value })}
              />
            </Field>
            <Field label="既往史" className="sm:col-span-2">
              <textarea
                className={textareaCls}
                value={form["既往史"] || ""}
                onChange={e => setForm({ ...form, 既往史: e.target.value })}
              />
            </Field>
          </div>

          {/* 初步诊断 */}
          <div className="border-t pt-3">
            <div className="mb-1 text-sm font-medium">初步诊断</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {shortcuts.map(s => (
                <span key={s} className="flex items-center gap-0.5">
                  <button
                    className="bg-accent text-accent-foreground hover:bg-primary/20 rounded-full px-2.5 py-1 text-xs"
                    onClick={() => addDiagnosis(s)}
                  >
                    {s}
                  </button>
                  <button
                    className="text-muted-foreground hover:text-foreground rounded-full p-0.5"
                    onClick={() => removeShortcut(s)}
                    title="删除快捷键"
                  >
                    <IconX size={12} />
                  </button>
                </span>
              ))}
              <span className="flex items-center gap-1">
                <input
                  className={inputCls + " h-7 w-28 px-2 text-xs"}
                  placeholder="新快捷键"
                  value={newShortcut}
                  onChange={e => setNewShortcut(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addShortcut()}
                />
                <button
                  className="bg-primary text-primary-foreground rounded-full p-1"
                  onClick={addShortcut}
                  title="添加快捷键"
                >
                  <IconPlus size={12} />
                </button>
              </span>
            </div>

            <div className="space-y-1.5">
              {diagnoses.length === 0 && (
                <div className="text-muted-foreground text-xs">点击上方快捷键或输入诊断，逐条添加</div>
              )}
              {diagnoses.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-4 text-xs">{i + 1}.</span>
                  <input
                    className={inputCls}
                    value={d}
                    onChange={e =>
                      setDiagnoses(prev => prev.map((x, j) => (j === i ? e.target.value : x)))
                    }
                  />
                  <button
                    className="text-muted-foreground hover:text-foreground rounded p-1"
                    onClick={() => setDiagnoses(prev => prev.filter((_, j) => j !== i))}
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ))}
              <button
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                onClick={() => setDiagnoses(prev => [...prev, ""])}
              >
                <IconPlus size={13} />
                添加诊断
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="hover:bg-accent rounded-md px-3 py-2 text-sm"
              onClick={() => setShowNew(false)}
            >
              取消
            </button>
            <button
              className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
              disabled={saving}
              onClick={createPatient}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <Empty text={patients.length === 0 ? "暂无患者，点击「添加患者」开始" : "无匹配患者"} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <button
              key={p.patient_id}
              onClick={() => onSelectPatient(p)}
              className="hover:bg-accent border-border rounded-lg border p-4 text-left transition"
            >
              <div className="text-base font-semibold">
                {p.姓名 || p.patient_id}
              </div>
              {p.病案号 ? (
                <div className="text-muted-foreground mt-0.5 text-xs">
                  病案号：{p.病案号}
                </div>
              ) : null}
              <div className="text-muted-foreground mt-1 text-sm">
                {[p.性别, p.年龄 ? `${p.年龄}岁` : ""].filter(Boolean).join(" · ") ||
                  "—"}
              </div>
              {p.过敏史 ? (
                <div className="text-muted-foreground mt-1 text-xs">
                  过敏：{p.过敏史}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
