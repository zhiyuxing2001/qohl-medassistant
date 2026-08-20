"use client"

import { api, Patient } from "@/lib/api"
import { IconPlus, IconStethoscope, IconTemplate } from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Empty, Field, inputCls, textareaCls } from "./ui"

export function PatientList() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setPatients(await api.get<Patient[]>("/api/patients"))
    } catch (e: any) {
      toast.error(`后端连接失败：${e.message || e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
      toast.success("已创建患者")
      setShowNew(false)
      setForm({})
      await load()
      router.push(`/gi/${p.patient_id}`)
    } catch (e: any) {
      toast.error(e.message || "创建失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconStethoscope size={24} />
          <h1 className="text-xl font-semibold">GI 医疗工作区</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/gi/templates"
            className="hover:bg-accent flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
          >
            <IconTemplate size={18} />
            模板与示例管理
          </Link>
          <button
            onClick={() => setShowNew(v => !v)}
            className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
          >
            <IconPlus size={18} />
            添加患者
          </button>
        </div>
      </div>

      {showNew && (
        <div className="border-border mb-4 space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">新建患者</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="脱敏编号 *">
              <input
                className={inputCls}
                placeholder="如 P001"
                value={form["脱敏编号"] || ""}
                onChange={e => setForm({ ...form, 脱敏编号: e.target.value })}
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

      {loading ? (
        <div className="text-muted-foreground p-8 text-center">加载中…</div>
      ) : patients.length === 0 ? (
        <Empty text="暂无患者，点击「添加患者」开始" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => (
            <button
              key={p.patient_id}
              onClick={() => router.push(`/gi/${p.patient_id}`)}
              className="hover:bg-accent border-border rounded-lg border p-4 text-left transition"
            >
              <div className="text-base font-semibold">
                {p.脱敏编号 || p.patient_id}
              </div>
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
