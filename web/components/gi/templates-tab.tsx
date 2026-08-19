"use client"

import { Example, Template, api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { IconShieldCheck } from "@tabler/icons-react"
import { toast } from "sonner"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, Empty, Field, SectionTitle, inputCls, textareaCls } from "./ui"

interface Props {
  templates: Template[]
  onRefreshTemplates: () => void
}

export function TemplatesTab({ templates, onRefreshTemplates }: Props) {
  const [selectedCode, setSelectedCode] = useState<string>("")
  const [templateText, setTemplateText] = useState<string>("")
  const [savingTpl, setSavingTpl] = useState(false)

  const [exContent, setExContent] = useState("")
  const [exSource, setExSource] = useState("")
  const [exAnon, setExAnon] = useState(false)
  const [addingEx, setAddingEx] = useState(false)

  const [anonInput, setAnonInput] = useState("")
  const [anonResult, setAnonResult] = useState<{ found?: boolean; matches?: any[] } | null>(null)
  const [anonReplaced, setAnonReplaced] = useState("")

  const selected = templates.find(t => t.code === selectedCode)

  const selectTemplate = (t: Template) => {
    setSelectedCode(t.code)
    setTemplateText(t.template || "")
  }

  const saveTemplate = async () => {
    if (!selected) return
    setSavingTpl(true)
    try {
      await api.put(`/api/templates/${selected.code}/template`, {
        text: templateText
      })
      toast.success("模板已保存")
      await onRefreshTemplates()
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setSavingTpl(false)
    }
  }

  const addExample = async () => {
    if (!selected) return
    setAddingEx(true)
    try {
      await api.post(`/api/templates/${selected.code}/examples`, {
        content: exContent,
        source: exSource,
        anonymized: exAnon
      })
      toast.success("示例已添加")
      setExContent("")
      setExSource("")
      setExAnon(false)
      await onRefreshTemplates()
    } catch (e: any) {
      toast.error(e.message || "添加失败")
    } finally {
      setAddingEx(false)
    }
  }

  const toggleActive = async (ex: Example, active: boolean) => {
    if (!selected) return
    try {
      await api.post(
        `/api/templates/${selected.code}/examples/${ex.example_id}/active`,
        { active }
      )
      toast.success(active ? "已启用" : "已停用")
      await onRefreshTemplates()
    } catch (e: any) {
      if (e.status === 400) {
        toast.error("未脱敏禁止启用，请先脱敏并人工复核")
      } else {
        toast.error(e.message || "操作失败")
      }
    }
  }

  const runDetect = async () => {
    try {
      const r = await api.post<any>("/api/anon/detect", { text: anonInput })
      setAnonResult(r)
    } catch (e: any) {
      toast.error(e.message || "检测失败")
    }
  }

  const runReplace = async () => {
    try {
      const r = await api.post<any>("/api/anon/replace", { text: anonInput })
      setAnonReplaced(r.text || "")
    } catch (e: any) {
      toast.error(e.message || "替换失败")
    }
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
      {/* 模板列表 */}
      <Card className="overflow-x-auto">
        <SectionTitle>文书类型模板</SectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="py-2 pr-2">类型</th>
              <th className="py-2 pr-2">阶段</th>
              <th className="py-2 pr-2">要素</th>
              <th className="py-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr
                key={t.code}
                className={cn(
                  "cursor-pointer border-b hover:bg-accent",
                  selectedCode === t.code && "bg-accent"
                )}
                onClick={() => selectTemplate(t)}
              >
                <td className="py-2 pr-2 font-medium">{t.name}</td>
                <td className="py-2 pr-2">{t.phase}</td>
                <td className="py-2 pr-2 text-xs">
                  {(t.required_fields || []).join("、")}
                </td>
                <td className="py-2">
                  {t.is_active ? (
                    <Badge variant="secondary">启用</Badge>
                  ) : (
                    <Badge variant="outline">停用</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* 模板编辑 + 示例 */}
      <div className="space-y-4">
        {selected ? (
          <>
            <Card>
              <SectionTitle>{selected.name} · 空白模板</SectionTitle>
              <textarea
                className={textareaCls + " min-h-[160px] font-mono text-xs"}
                value={templateText}
                onChange={e => setTemplateText(e.target.value)}
                placeholder="在此编辑空白模板…"
              />
              <button
                className="bg-primary text-primary-foreground mt-2 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
                disabled={savingTpl}
                onClick={saveTemplate}
              >
                保存模板
              </button>
            </Card>

            <Card>
              <SectionTitle>示例列表</SectionTitle>
              {!selected.examples || selected.examples.length === 0 ? (
                <Empty text="暂无示例" />
              ) : (
                <div className="space-y-2">
                  {selected.examples.map(ex => (
                    <div
                      key={ex.example_id}
                      className="border-border rounded-md border p-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {ex.source || "无来源"}
                          </span>
                          {ex.anonymized ? (
                            <Badge variant="secondary">已脱敏</Badge>
                          ) : (
                            <Badge variant="outline">未脱敏</Badge>
                          )}
                          {ex.is_active ? (
                            <Badge variant="secondary">启用</Badge>
                          ) : (
                            <Badge variant="outline">停用</Badge>
                          )}
                        </div>
                        <button
                          className="hover:bg-accent rounded px-2 py-0.5"
                          onClick={() => toggleActive(ex, !ex.is_active)}
                        >
                          {ex.is_active ? "停用" : "启用"}
                        </button>
                      </div>
                      <div className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {ex.content.slice(0, 120)}
                        {ex.content.length > 120 ? "…" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 border-t pt-3">
                <SectionTitle>添加示例</SectionTitle>
                <Field label="内容">
                  <textarea
                    className={textareaCls}
                    value={exContent}
                    onChange={e => setExContent(e.target.value)}
                  />
                </Field>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Field label="来源">
                    <input
                      className={inputCls}
                      value={exSource}
                      onChange={e => setExSource(e.target.value)}
                    />
                  </Field>
                  <label className="flex items-center gap-2 pt-5 text-sm">
                    <input
                      type="checkbox"
                      checked={exAnon}
                      onChange={e => setExAnon(e.target.checked)}
                    />
                    已脱敏
                  </label>
                </div>
                <button
                  className="bg-primary text-primary-foreground mt-2 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
                  disabled={addingEx}
                  onClick={addExample}
                >
                  添加示例
                </button>
              </div>
            </Card>
          </>
        ) : (
          <Card>
            <Empty text="请选择左侧文书类型" />
          </Card>
        )}

        {/* 脱敏工具 */}
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <IconShieldCheck size={18} />
            <SectionTitle className="mb-0">脱敏检测 / 替换</SectionTitle>
          </div>
          <textarea
            className={textareaCls}
            value={anonInput}
            onChange={e => setAnonInput(e.target.value)}
            placeholder="粘贴需要检测/脱敏的文本…"
          />
          <div className="mt-2 flex gap-2">
            <button
              className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
              onClick={runDetect}
            >
              检测
            </button>
            <button
              className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
              onClick={runReplace}
            >
              替换
            </button>
          </div>

          {anonResult && (
            <div className="mt-2 text-xs">
              <span className="font-semibold">
                {anonResult.found
                  ? `检测到 ${(anonResult.matches || []).length} 处敏感信息`
                  : "未检测到敏感信息"}
              </span>
              {(anonResult.matches || []).length > 0 && (
                <div className="text-muted-foreground mt-1 max-h-32 overflow-y-auto">
                  {anonResult.matches?.map((m: any, i: number) => (
                    <div key={i}>{JSON.stringify(m)}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {anonReplaced && (
            <div className="mt-2">
              <div className="text-xs font-semibold">替换结果：</div>
              <div className="border-border mt-1 whitespace-pre-wrap rounded-md border p-2 text-xs">
                {anonReplaced}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
