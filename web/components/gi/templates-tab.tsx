"use client"

import { api, Example, Template } from "@/lib/api"
import { IconPlus, IconShieldCheck } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card, Empty, Field, SectionTitle, inputCls, textareaCls } from "./ui"

interface Props {
  templates: Template[]
  onRefreshTemplates: () => void
}

export function TemplatesTab({ templates, onRefreshTemplates }: Props) {
  const [code, setCode] = useState<string>("")
  const [variant, setVariant] = useState<string>("通用")
  const [templateText, setTemplateText] = useState("")
  const [newVariant, setNewVariant] = useState("")

  const [exContent, setExContent] = useState("")
  const [exSource, setExSource] = useState("")
  const [exAnon, setExAnon] = useState(false)

  const [anonInput, setAnonInput] = useState("")
  const [anonResult, setAnonResult] = useState<{ found?: boolean; matches?: any[] } | null>(null)
  const [anonReplaced, setAnonReplaced] = useState("")

  const selected = templates.find(t => t.code === code)
  const variants = selected?.variants || []
  const currentVariant = variants.find(v => v.病种 === variant)

  useEffect(() => {
    setTemplateText(currentVariant?.template || "")
  }, [code, variant, currentVariant?.template])

  const saveTemplate = async () => {
    if (!selected) return
    try {
      await api.put(`/api/templates/${selected.code}/variants/${encodeURIComponent(variant)}`, {
        text: templateText
      })
      toast.success("模板已保存")
      await onRefreshTemplates()
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    }
  }

  const createVariant = async () => {
    const name = newVariant.trim()
    if (!name) return
    setVariant(name)
    setTemplateText("")
    setNewVariant("")
    toast.success(`已创建病种「${name}」，保存模板后生效`)
  }

  const addExample = async () => {
    if (!selected || !exContent.trim()) return
    try {
      await api.post(
        `/api/templates/${selected.code}/variants/${encodeURIComponent(variant)}/examples`,
        { content: exContent, source: exSource, anonymized: exAnon }
      )
      toast.success("示例已添加（默认未启用，需脱敏复核后启用）")
      setExContent("")
      setExSource("")
      setExAnon(false)
      await onRefreshTemplates()
    } catch (e: any) {
      toast.error(e.message || "添加失败")
    }
  }

  const toggleExample = async (ex: Example, active: boolean) => {
    if (!selected) return
    try {
      await api.post(
        `/api/templates/${selected.code}/variants/${encodeURIComponent(variant)}/examples/${ex.example_id}/active`,
        { active }
      )
      toast.success(active ? "已启用" : "已停用")
      await onRefreshTemplates()
    } catch (e: any) {
      toast.error(e.message || "操作失败")
    }
  }

  const detectAnon = async () => {
    try {
      setAnonResult(await api.post("/api/anon/detect", { text: anonInput }))
      setAnonReplaced((await api.post("/api/anon/replace", { text: anonInput })).text)
    } catch (e: any) {
      toast.error(e.message || "脱敏检测失败")
    }
  }

  return (
    <div className="flex gap-4">
      {/* 左：文书类型 */}
      <div className="w-56 shrink-0 overflow-y-auto border-r pr-2">
        <div className="text-muted-foreground mb-2 text-xs font-medium">文书类型</div>
        {templates.map(t => (
          <button
            key={t.code}
            onClick={() => {
              setCode(t.code)
              setVariant("通用")
            }}
            className={
              (code === t.code ? "bg-accent " : "hover:bg-accent ") +
              "block w-full rounded-md px-2 py-1.5 text-left text-sm"
            }
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* 中：病种 */}
      <div className="w-48 shrink-0 overflow-y-auto border-r pr-2">
        <div className="text-muted-foreground mb-2 text-xs font-medium">病种模板</div>
        {selected ? (
          <>
            {variants.map(v => (
              <button
                key={v.病种}
                onClick={() => setVariant(v.病种)}
                className={
                  (variant === v.病种 ? "bg-accent " : "hover:bg-accent ") +
                  "block w-full rounded-md px-2 py-1.5 text-left text-sm"
                }
              >
                {v.病种}
              </button>
            ))}
            <div className="mt-2 flex gap-1">
              <input
                className={inputCls + " h-8 px-2 text-xs"}
                placeholder="新病种名"
                value={newVariant}
                onChange={e => setNewVariant(e.target.value)}
              />
              <button
                className="bg-primary text-primary-foreground rounded-md p-1.5"
                onClick={createVariant}
              >
                <IconPlus size={14} />
              </button>
            </div>
          </>
        ) : (
          <Empty text="选择文书类型" />
        )}
      </div>

      {/* 右：模板编辑 + 示例 + 脱敏 */}
      <div className="min-w-0 flex-1 space-y-4">
        {selected ? (
          <>
            <Card>
              <SectionTitle>
                {selected.name} · {variant} 模板
              </SectionTitle>
              <textarea
                className={textareaCls + " min-h-[200px]"}
                value={templateText}
                onChange={e => setTemplateText(e.target.value)}
                placeholder="在此粘贴或编写该病种的空白模板（章节标题、固定措辞、留空位）"
              />
              <div className="mt-2 flex justify-end">
                <button
                  className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                  onClick={saveTemplate}
                >
                  保存模板
                </button>
              </div>
            </Card>

            <Card>
              <SectionTitle>示例病历（few-shot）</SectionTitle>
              <div className="mb-3 space-y-2">
                {(currentVariant?.examples || []).length === 0 && (
                  <div className="text-muted-foreground text-xs">暂无示例</div>
                )}
                {(currentVariant?.examples || []).map(ex => (
                  <div key={ex.example_id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{ex.content.slice(0, 60)}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ex.is_active ? "default" : "outline"}>
                          {ex.is_active ? "已启用" : "未启用"}
                        </Badge>
                        <Badge variant={ex.anonymized ? "default" : "destructive"}>
                          {ex.anonymized ? "已脱敏" : "未脱敏"}
                        </Badge>
                      </div>
                    </div>
                    <button
                      className="hover:bg-accent rounded-md border px-2 py-1 text-xs"
                      onClick={() => toggleExample(ex, !ex.is_active)}
                    >
                      {ex.is_active ? "停用" : "启用"}
                    </button>
                  </div>
                ))}
              </div>
              <Field label="示例内容（脱敏后粘贴）">
                <textarea
                  className={textareaCls}
                  rows={3}
                  value={exContent}
                  onChange={e => setExContent(e.target.value)}
                />
              </Field>
              <div className="mt-2 flex items-center gap-3">
                <input
                  className={inputCls}
                  placeholder="来源（可选）"
                  value={exSource}
                  onChange={e => setExSource(e.target.value)}
                />
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={exAnon}
                    onChange={e => setExAnon(e.target.checked)}
                  />
                  已脱敏
                </label>
                <button
                  className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm"
                  onClick={addExample}
                >
                  添加示例
                </button>
              </div>
            </Card>

            <Card>
              <SectionTitle>
                <span className="flex items-center gap-1">
                  <IconShieldCheck size={16} />
                  脱敏辅助
                </span>
              </SectionTitle>
              <textarea
                className={textareaCls}
                rows={3}
                value={anonInput}
                onChange={e => setAnonInput(e.target.value)}
                placeholder="粘贴含敏感信息的文本，检测并替换"
              />
              <button
                className="bg-primary text-primary-foreground mt-2 rounded-md px-3 py-2 text-sm"
                onClick={detectAnon}
              >
                检测并替换
              </button>
              {anonResult && (
                <div className="mt-2 text-xs">
                  <div>
                    检测到 {anonResult.matches?.length || 0} 处敏感信息
                    {anonResult.matches?.map((m, i) => (
                      <div key={i} className="text-muted-foreground">
                        {m.类型}: {m.内容}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <div className="font-medium">替换后：</div>
                    <pre className="bg-accent/50 rounded-md p-2 whitespace-pre-wrap">
                      {anonReplaced}
                    </pre>
                  </div>
                </div>
              )}
            </Card>
          </>
        ) : (
          <Empty text="选择文书类型开始管理模板" />
        )}
      </div>
    </div>
  )
}
