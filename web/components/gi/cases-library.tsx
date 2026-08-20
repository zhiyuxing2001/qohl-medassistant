"use client"

import { api, CaseItem } from "@/lib/api"
import { IconFilePlus, IconPencil, IconTrash } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Empty, Field, inputCls, textareaCls } from "./ui"

export function CasesLibrary() {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [dept, setDept] = useState<string>("")
  const [disease, setDisease] = useState<string>("")
  const [selected, setSelected] = useState<CaseItem | null>(null)
  const [editing, setEditing] = useState<CaseItem | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    try {
      setCases(await api.get<CaseItem[]>("/api/cases"))
    } catch (e: any) {
      toast.error(e.message || "加载病例库失败")
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const tree = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const c of cases) {
      const d = c.科室 || "未分类"
      if (!m[d]) m[d] = []
      if (!m[d].includes(c.病种 || "未分类")) m[d].push(c.病种 || "未分类")
    }
    return m
  }, [cases])

  const depts = Object.keys(tree).sort()
  const diseases = (dept && tree[dept]) || []

  const filtered = useMemo(() => {
    return cases.filter(
      c =>
        (!dept || c.科室 === dept) && (!disease || c.病种 === disease)
    )
  }, [cases, dept, disease])

  const startNew = () => {
    setEditing({ case_id: "", 科室: dept, 病种: disease, 标题: "", 内容: "" } as CaseItem)
    setForm({ 科室: dept, 病种: disease, 标题: "", 内容: "" })
  }

  const startEdit = (c: CaseItem) => {
    setEditing(c)
    setForm({ 科室: c.科室, 病种: c.病种, 标题: c.标题, 内容: c.内容 })
  }

  const save = async () => {
    if (!form["标题"]?.trim()) {
      toast.error("标题不能为空")
      return
    }
    try {
      if (editing?.case_id) {
        await api.put(`/api/cases/${editing.case_id}`, form)
        toast.success("已更新病例")
      } else {
        await api.post("/api/cases", form)
        toast.success("已创建病例")
      }
      setEditing(null)
      setForm({})
      await load()
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    }
  }

  const remove = async (c: CaseItem) => {
    if (!confirm(`删除病例「${c.标题}」？`)) return
    try {
      await api.del(`/api/cases/${c.case_id}`)
      toast.success("已删除")
      if (selected?.case_id === c.case_id) setSelected(null)
      await load()
    } catch (e: any) {
      toast.error(e.message || "删除失败")
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">病例库（典型病例）</h2>
        <button
          onClick={startNew}
          className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
        >
          <IconFilePlus size={16} />
          新建病例
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* 左：科室/病种树 */}
        <div className="w-56 shrink-0 overflow-y-auto border-r pr-2">
          <div className="text-muted-foreground mb-2 text-xs font-medium">科室</div>
          {depts.length === 0 ? (
            <Empty text="暂无病例" />
          ) : (
            depts.map(d => (
              <div key={d} className="mb-1">
                <button
                  onClick={() => {
                    setDept(d)
                    setDisease("")
                  }}
                  className={
                    (dept === d && !disease ? "bg-accent " : "hover:bg-accent ") +
                    "w-full rounded-md px-2 py-1.5 text-left text-sm font-medium"
                  }
                >
                  {d}
                </button>
                {tree[d].map(ds => (
                  <button
                    key={ds}
                    onClick={() => {
                      setDept(d)
                      setDisease(ds)
                    }}
                    className={
                      (dept === d && disease === ds
                        ? "bg-accent "
                        : "text-muted-foreground hover:bg-accent ") +
                      "ml-3 block w-[calc(100%-0.75rem)] rounded-md px-2 py-1 text-left text-sm"
                    }
                  >
                    {ds}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* 右：病例列表 + 详情 */}
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="w-72 shrink-0 overflow-y-auto border-r pr-2">
            {filtered.length === 0 ? (
              <Empty text={ready ? "该分类下暂无病例" : "加载中…"} />
            ) : (
              filtered.map(c => (
                <div
                  key={c.case_id}
                  className={
                    (selected?.case_id === c.case_id ? "bg-accent " : "hover:bg-accent ") +
                    "mb-1 flex items-center justify-between rounded-md p-2"
                  }
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelected(c)}
                  >
                    <div className="truncate text-sm font-medium">{c.标题}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {c.科室} · {c.病种}
                    </div>
                  </button>
                  <div className="flex gap-1">
                    <button className="hover:bg-accent rounded p-1" onClick={() => startEdit(c)}>
                      <IconPencil size={14} />
                    </button>
                    <button className="hover:bg-accent rounded p-1" onClick={() => remove(c)}>
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto">
            {editing ? (
              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">
                  {editing.case_id ? "编辑病例" : "新建病例"}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="科室">
                    <input
                      className={inputCls}
                      value={form["科室"] || ""}
                      onChange={e => setForm({ ...form, 科室: e.target.value })}
                    />
                  </Field>
                  <Field label="病种">
                    <input
                      className={inputCls}
                      value={form["病种"] || ""}
                      onChange={e => setForm({ ...form, 病种: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="标题">
                  <input
                    className={inputCls}
                    value={form["标题"] || ""}
                    onChange={e => setForm({ ...form, 标题: e.target.value })}
                  />
                </Field>
                <Field label="内容（病史摘要 / 诊断 / 诊疗要点）">
                  <textarea
                    className={textareaCls}
                    rows={10}
                    value={form["内容"] || ""}
                    onChange={e => setForm({ ...form, 内容: e.target.value })}
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <button
                    className="hover:bg-accent rounded-md px-3 py-2 text-sm"
                    onClick={() => setEditing(null)}
                  >
                    取消
                  </button>
                  <button
                    className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                    onClick={save}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : selected ? (
              <div>
                <h3 className="mb-2 text-base font-semibold">{selected.标题}</h3>
                <div className="text-muted-foreground mb-3 text-xs">
                  {selected.科室} · {selected.病种}
                </div>
                <div className="text-sm leading-6 whitespace-pre-wrap">
                  {selected.内容 || "（无内容）"}
                </div>
              </div>
            ) : (
              <Empty text="选择左侧病例查看，或点击「新建病例」" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
