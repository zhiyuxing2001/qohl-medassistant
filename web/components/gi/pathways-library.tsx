"use client"

import { api, Pathway } from "@/lib/api"
import { IconFilePlus, IconTrash } from "@tabler/icons-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Empty, Field, inputCls, textareaCls } from "./ui"

export function PathwaysLibrary() {
  const [pathways, setPathways] = useState<Pathway[]>([])
  const [selected, setSelected] = useState<Pathway | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    try {
      setPathways(await api.get<Pathway[]>("/api/pathways"))
    } catch (e: any) {
      toast.error(e.message || "加载临床路径失败")
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startNew = () => {
    setSelected(null)
    setEditing(true)
    setForm({ 病种: "", 科室: "", 内容: "" })
  }

  const startEdit = (p: Pathway) => {
    setSelected(p)
    setEditing(true)
    setForm({ 病种: p.病种, 科室: p.科室 || "", 内容: p.内容 })
  }

  const save = async () => {
    if (!form["病种"]?.trim()) {
      toast.error("病种不能为空")
      return
    }
    try {
      if (selected?.pathway_id) {
        await api.put(`/api/pathways/${selected.pathway_id}`, form)
        toast.success("已更新")
      } else {
        await api.post("/api/pathways", form)
        toast.success("已创建")
      }
      setEditing(false)
      setForm({})
      await load()
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    }
  }

  const remove = async (p: Pathway) => {
    if (!confirm(`删除「${p.病种}」的临床路径？`)) return
    try {
      await api.del(`/api/pathways/${p.pathway_id}`)
      toast.success("已删除")
      if (selected?.pathway_id === p.pathway_id) setSelected(null)
      await load()
    } catch (e: any) {
      toast.error(e.message || "删除失败")
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">临床路径</h2>
        <button
          onClick={startNew}
          className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
        >
          <IconFilePlus size={16} />
          新增路径
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* 左：病种列表 */}
        <div className="w-64 shrink-0 overflow-y-auto border-r pr-2">
          {pathways.length === 0 ? (
            <Empty text={ready ? "暂无临床路径" : "加载中…"} />
          ) : (
            pathways.map(p => (
              <div
                key={p.pathway_id}
                className={
                  (selected?.pathway_id === p.pathway_id ? "bg-accent " : "hover:bg-accent ") +
                  "mb-1 flex items-center justify-between rounded-md p-2"
                }
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => startEdit(p)}>
                  <div className="truncate text-sm font-medium">{p.病种}</div>
                  {p.科室 && (
                    <div className="text-muted-foreground truncate text-xs">{p.科室}</div>
                  )}
                </button>
                <button className="hover:bg-accent rounded p-1" onClick={() => remove(p)}>
                  <IconTrash size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* 右：编辑/查看 */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {editing ? (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">
                {selected?.pathway_id ? "编辑临床路径" : "新增临床路径"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="病种 *">
                  <input
                    className={inputCls}
                    value={form["病种"] || ""}
                    onChange={e => setForm({ ...form, 病种: e.target.value })}
                  />
                </Field>
                <Field label="科室">
                  <input
                    className={inputCls}
                    value={form["科室"] || ""}
                    onChange={e => setForm({ ...form, 科室: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="路径内容（入院评估 / 检查 / 治疗分期 / 护理 / 出院标准）">
                <textarea
                  className={textareaCls}
                  rows={14}
                  value={form["内容"] || ""}
                  onChange={e => setForm({ ...form, 内容: e.target.value })}
                  placeholder={"示例：\n【入院评估】…\n【检查】…\n【治疗】第1-3天禁食补液…\n【出院标准】…"}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <button
                  className="hover:bg-accent rounded-md px-3 py-2 text-sm"
                  onClick={() => setEditing(false)}
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
              <h3 className="mb-1 text-base font-semibold">{selected.病种}</h3>
              <div className="text-muted-foreground mb-3 text-xs">{selected.科室}</div>
              <div className="text-sm leading-6 whitespace-pre-wrap">
                {selected.内容 || "（无内容）"}
              </div>
              <button
                className="hover:bg-accent mt-3 rounded-md border px-3 py-1.5 text-sm"
                onClick={() => startEdit(selected)}
              >
                编辑
              </button>
            </div>
          ) : (
            <Empty text="选择左侧路径查看，或点击「新增路径」" />
          )}
        </div>
      </div>
    </div>
  )
}
