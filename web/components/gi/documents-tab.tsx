"use client"

import { MessageMarkdown } from "@/components/messages/message-markdown"
import {
  DocumentItem,
  Patient,
  Template,
  Visit,
  api,
  GI_API_BASE
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { IconArrowBack, IconDownload, IconSend } from "@tabler/icons-react"
import { toast } from "sonner"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, Empty, Field, SectionTitle, inputCls } from "./ui"

interface Props {
  patient: Patient | null
  visit: Visit | null
  templates: Template[]
}

type Revision = { revision: string; content: string }

export function DocumentsTab({ patient, visit, templates }: Props) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selected, setSelected] = useState<DocumentItem | null>(null)
  const [draft, setDraft] = useState("")

  const [docType, setDocType] = useState("")
  const [docDate, setDocDate] = useState("")
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})
  const [materialIds, setMaterialIds] = useState("")
  const [warnings, setWarnings] = useState<string[]>([])
  const [promptVersion, setPromptVersion] = useState("")

  const [generating, setGenerating] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [revisions, setRevisions] = useState<Revision[]>([])

  const chatRef = useRef<HTMLTextAreaElement>(null)

  const selectedTemplate = templates.find(t => t.code === docType)

  const loadDocuments = async () => {
    if (!patient || !visit) return
    try {
      const data = await api.get<DocumentItem[]>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents`
      )
      setDocuments(data)
    } catch (e: any) {
      toast.error(e.message || "加载文书失败")
    }
  }

  useEffect(() => {
    setSelected(null)
    setDraft("")
    setRevisions([])
    setWarnings([])
    if (patient && visit) loadDocuments()
  }, [patient?.patient_id, visit?.visit_id])

  const selectDoc = async (d: DocumentItem) => {
    if (!patient || !visit) return
    setSelected(d)
    setDraft(d.content || "")
    try {
      const full = await api.get<DocumentItem>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/${d.doc_id}`
      )
      setDraft(full.content || "")
      const revs = await api.get<Revision[]>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/${d.doc_id}/revisions`
      )
      setRevisions(revs)
    } catch (e: any) {
      toast.error(e.message || "加载文书详情失败")
    }
  }

  const generate = async () => {
    if (!patient || !visit) return
    if (!docType) {
      toast.error("请选择文书类型")
      return
    }
    setGenerating(true)
    setWarnings([])
    try {
      const res = await api.post<any>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/generate`,
        {
          doc_type: docType,
          doc_date: docDate,
          extra_fields: extraFields,
          material_ids: parseIds(materialIds)
        }
      )
      setWarnings(res.warnings || [])
      setPromptVersion(res.prompt_version || "")
      const doc = res.document
      setSelected(doc)
      setDraft(doc.content || "")
      setRevisions([])
      toast.success("已生成草稿")
      await loadDocuments()
    } catch (e: any) {
      toast.error(e.message || "生成失败")
    } finally {
      setGenerating(false)
    }
  }

  const sendChat = async () => {
    if (!patient || !visit || !selected) return
    const msg = chatInput.trim()
    if (!msg) return
    setChatInput("")
    setStreaming(true)
    let acc = ""
    setDraft("")
    try {
      await api.stream(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/${selected.doc_id}/chat`,
        { message: msg, material_ids: parseIds(materialIds) },
        (event, data) => {
          if (event === "delta") {
            acc += data.text || ""
            setDraft(acc)
          } else if (event === "done") {
            // 修订已保存
          }
        }
      )
      toast.success("对话修订完成")
      await refreshAfterRevise()
    } catch (e: any) {
      toast.error(e.message || "对话修订失败")
    } finally {
      setStreaming(false)
    }
  }

  const refreshAfterRevise = async () => {
    if (!patient || !visit || !selected) return
    try {
      const full = await api.get<DocumentItem>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/${selected.doc_id}`
      )
      setDraft(full.content || "")
      setSelected(full)
      const revs = await api.get<Revision[]>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/${selected.doc_id}/revisions`
      )
      setRevisions(revs)
      await loadDocuments()
    } catch (e: any) {
      toast.error(e.message || "刷新失败")
    }
  }

  const revert = async (rev: string) => {
    if (!patient || !visit || !selected) return
    try {
      const doc = await api.post<DocumentItem>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/${selected.doc_id}/revert`,
        { revision: rev }
      )
      setSelected(doc)
      setDraft(doc.content || "")
      toast.success(`已回退到 ${rev}`)
      await refreshAfterRevise()
    } catch (e: any) {
      toast.error(e.message || "回退失败")
    }
  }

  const confirmDoc = async () => {
    if (!patient || !visit || !selected) return
    try {
      const doc = await api.post<DocumentItem>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/${selected.doc_id}/confirm`
      )
      setSelected(doc)
      toast.success("已确认文书")
      await loadDocuments()
    } catch (e: any) {
      toast.error(e.message || "确认失败")
    }
  }

  const exportDoc = () => {
    if (!patient || !visit || !selected) return
    const url = `${GI_API_BASE}/api/patients/${patient.patient_id}/visits/${visit.visit_id}/documents/${selected.doc_id}/export`
    const a = document.createElement("a")
    a.href = url
    a.download = ""
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  if (!patient || !visit) {
    return (
      <div className="p-4">
        <Empty text="请先选择患者与住院记录" />
      </div>
    )
  }

  return (
    <div className="grid h-full gap-4 p-4 lg:grid-cols-[300px_1fr]">
      {/* 左侧文书列表 */}
      <Card className="overflow-y-auto">
        <SectionTitle>文书列表</SectionTitle>
        {documents.length === 0 ? (
          <Empty text="暂无文书" />
        ) : (
          <div className="space-y-1">
            {documents.map(d => (
              <button
                key={d.doc_id}
                className={cn(
                  "hover:bg-accent block w-full rounded-md px-2 py-2 text-left",
                  selected?.doc_id === d.doc_id && "bg-accent"
                )}
                onClick={() => selectDoc(d)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {templates.find(t => t.code === d.doc_type)?.name ||
                      d.doc_type}
                  </span>
                  <Badge
                    variant={d.status === "已确认" ? "secondary" : "outline"}
                  >
                    {d.status}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-xs">
                  {d.doc_date}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {d.preview || d.summary || ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* 右侧工作区 */}
      <div className="flex min-h-0 flex-col gap-3">
        <Card>
          <SectionTitle>生成新文书</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="文书类型">
              <select
                className={inputCls}
                value={docType}
                onChange={e => {
                  setDocType(e.target.value)
                  setExtraFields({})
                }}
              >
                <option value="">请选择…</option>
                {templates.map(t => (
                  <option key={t.code} value={t.code}>
                    {t.name}（{t.phase}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="文书日期">
              <input
                className={inputCls}
                type="date"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
              />
            </Field>
          </div>

          {selectedTemplate && selectedTemplate.required_fields.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {selectedTemplate.required_fields.map(f => (
                <Field key={f} label={f}>
                  <input
                    className={inputCls}
                    value={extraFields[f] || ""}
                    onChange={e =>
                      setExtraFields({ ...extraFields, [f]: e.target.value })
                    }
                    placeholder={`补充${f}`}
                  />
                </Field>
              ))}
            </div>
          )}

          <Field label="参考材料 material_ids（逗号分隔，可选）" className="mt-3">
            <input
              className={inputCls}
              value={materialIds}
              onChange={e => setMaterialIds(e.target.value)}
              placeholder="留空表示不挂载材料"
            />
          </Field>

          <button
            className="bg-primary text-primary-foreground mt-3 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={generating}
            onClick={generate}
          >
            {generating ? "生成中…" : "生成草稿"}
          </button>

          {warnings.length > 0 && (
            <div className="bg-amber-500/10 text-amber-600 mt-3 rounded-md border border-amber-500/30 p-2 text-xs">
              {warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
          {promptVersion && (
            <div className="text-muted-foreground mt-1 text-xs">
              提示词版本：{promptVersion}
            </div>
          )}
        </Card>

        <Card className="flex min-h-0 grow flex-col">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle className="mb-0">
              文书正文 {selected && `· ${selected.status}`}
            </SectionTitle>
            <div className="flex gap-2">
              {selected && (
                <>
                  <button
                    className="hover:bg-accent rounded-md border px-2 py-1 text-xs"
                    onClick={confirmDoc}
                  >
                    确认
                  </button>
                  <button
                    className="hover:bg-accent flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                    onClick={exportDoc}
                  >
                    <IconDownload size={14} /> 导出
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="min-h-40 grow overflow-y-auto rounded-md border p-3">
            {draft ? (
              <MessageMarkdown content={draft} />
            ) : (
              <div className="text-muted-foreground text-sm">
                生成文书后在此预览，或选择已有文书查看/修订。
              </div>
            )}
          </div>

          {/* 对话修订输入 */}
          {selected && (
            <div className="mt-3 flex items-end gap-2">
              <textarea
                ref={chatRef}
                className={inputCls + " min-h-[40px] resize-none"}
                rows={2}
                placeholder="输入修订要求，例如：请把诊断依据补充完整…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendChat()
                  }
                }}
              />
              <button
                className="bg-primary text-primary-foreground rounded-md px-3 py-2"
                disabled={streaming}
                onClick={sendChat}
                title="发送"
              >
                <IconSend size={16} />
              </button>
            </div>
          )}

          {revisions.length > 0 && (
            <div className="mt-3">
              <SectionTitle>修订历史</SectionTitle>
              <div className="space-y-1">
                {revisions.map(r => (
                  <div
                    key={r.revision}
                    className="hover:bg-accent flex items-center justify-between rounded px-2 py-1 text-xs"
                  >
                    <span className="font-medium">{r.revision}</span>
                    <span className="text-muted-foreground flex-1 truncate px-2">
                      {r.content.slice(0, 40)}
                    </span>
                    <button
                      className="hover:bg-accent flex items-center gap-1 rounded px-1.5 py-0.5"
                      onClick={() => revert(r.revision)}
                    >
                      <IconArrowBack size={13} /> 回退
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function parseIds(s: string): string[] {
  return s
    .split(/[,，\s]+/)
    .map(x => x.trim())
    .filter(Boolean)
}
