"use client"

import {
  api,
  DocumentItem,
  GI_API_BASE,
  Material,
  Patient,
  Template,
  Visit
} from "@/lib/api"
import {
  IconArrowLeft,
  IconCheck,
  IconFileDownload,
  IconSend
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Field, inputCls, SectionTitle, textareaCls } from "./ui"

const VITAL_FIELDS = ["体温", "脉搏", "呼吸", "血压", "SpO2", "体重"]

// 文书字段 → 患者/住院预填
function prefill(field: string, p: Patient | null, v: Visit | null): string {
  switch (field) {
    case "主诉":
      return v?.主诉 || ""
    case "现病史":
      return v?.现病史 || ""
    case "体格检查":
      return v?.体格检查 || ""
    case "初步诊断":
    case "入院诊断":
      return v?.入院诊断 || ""
    case "出院诊断":
      return v?.出院诊断 || ""
    case "既往史":
      return p?.既往史 || ""
    case "家族史":
      return p?.家族史 || ""
    default:
      return ""
  }
}

export function RecordEditor({
  pid,
  type,
  docId
}: {
  pid: string
  type?: string
  docId?: string
}) {
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [visit, setVisit] = useState<Visit | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [doc, setDoc] = useState<DocumentItem | null>(null)

  const [docType, setDocType] = useState(type || "")
  const [templateVariant, setTemplateVariant] = useState("通用")
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [vitals, setVitals] = useState<Record<string, string>>({})
  const [fields, setFields] = useState<Record<string, string>>({})
  const [materialIds, setMaterialIds] = useState<string[]>([])

  const [content, setContent] = useState("")
  const [revisions, setRevisions] = useState<{ revision: string; content: string }[]>([])
  const [chatMsgs, setChatMsgs] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [warnings, setWarnings] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const streamRef = useRef<{ text: string; role: string } | null>(null)

  const template = useMemo(
    () => templates.find(t => t.code === docType),
    [templates, docType]
  )

  const load = useCallback(async () => {
    try {
      const [p, ts] = await Promise.all([
        api.get<Patient>(`/api/patients/${pid}`),
        api.get<Template[]>("/api/templates")
      ])
      setPatient(p)
      setTemplates(ts)
      const vs = await api.get<Visit[]>(`/api/patients/${pid}/visits`)
      const v = vs[0] || null
      setVisit(v)

      if (docId) {
        const d = await api.get<DocumentItem>(
          `/api/patients/${pid}/visits/${v?.visit_id}/documents/${docId}`
        )
        setDoc(d)
        setDocType(d.doc_type)
        setDocDate(d.doc_date || docDate)
        setVitals(d.vitals || {})
        setFields(d.extra || {})
        setContent(d.content || "")
        const revs = await api.get<
          { revision: string; content: string }[]
        >(`/api/patients/${pid}/visits/${v?.visit_id}/documents/${docId}/revisions`)
        setRevisions(revs)
      }
      if (v) {
        setMaterials(await api.get<Material[]>(`/api/patients/${pid}/visits/${v.visit_id}/materials`))
      }
    } catch (e: any) {
      toast.error(e.message || "加载失败")
    } finally {
      setReady(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, docId])

  useEffect(() => {
    load()
  }, [load])

  // 默认挂载与记录日期匹配的材料
  useEffect(() => {
    if (!docId && materials.length > 0) {
      const matched = materials.filter(
        m => (m.日期 || (m.created_at || "").slice(0, 10)) === docDate
      )
      setMaterialIds(matched.map(m => m.material_id))
    }
  }, [materials, docId, docDate])

  // 文书字段初始化（按 required_fields 预填）
  useEffect(() => {
    if (template && !docId && Object.keys(fields).length === 0) {
      const init: Record<string, string> = {}
      for (const f of template.required_fields || []) {
        init[f] = prefill(f, patient, visit)
      }
      setFields(init)
    }
  }, [template, patient, visit, docId, fields])

  const vid = visit?.visit_id

  const generate = async () => {
    if (!vid) {
      toast.error("请先创建住院记录")
      return
    }
    setBusy(true)
    try {
      const res = await api.post<{
        document: DocumentItem
        warnings: any
        prompt_version: string
      }>(`/api/patients/${pid}/visits/${vid}/documents/generate`, {
        doc_type: docType,
        doc_date: docDate,
        extra_fields: fields,
        vitals,
        template_variant: templateVariant,
        material_ids: materialIds
      })
      setWarnings(res.warnings)
      const newId = res.document.doc_id
      toast.success("已生成草稿")
      // 切到编辑态（复用本页，重新加载该文书）
      router.replace(`/gi/${pid}/records/${newId}`)
    } catch (e: any) {
      toast.error(e.message || "生成失败")
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!vid || !docId) return
    setBusy(true)
    try {
      await api.put(`/api/patients/${pid}/visits/${vid}/documents/${docId}/content`, {
        content,
        vitals
      })
      toast.success("已保存")
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setBusy(false)
    }
  }

  const confirmDoc = async () => {
    if (!vid || !docId) return
    setBusy(true)
    try {
      const d = await api.post<DocumentItem>(
        `/api/patients/${pid}/visits/${vid}/documents/${docId}/confirm`
      )
      setDoc(d)
      toast.success("已确认")
    } catch (e: any) {
      toast.error(e.message || "确认失败")
    } finally {
      setBusy(false)
    }
  }

  const sendChat = async () => {
    if (!vid || !docId || !chatInput.trim() || streaming) return
    const msg = chatInput.trim()
    setChatInput("")
    setChatMsgs(prev => [...prev, { role: "user", content: msg }])
    setStreaming(true)
    streamRef.current = { text: "", role: "assistant" }
    setChatMsgs(prev => [...prev, { role: "assistant", content: "" }])
    try {
      await api.stream(
        `/api/patients/${pid}/visits/${vid}/documents/${docId}/chat`,
        { message: msg, material_ids: materialIds },
        (event, data) => {
          if (event === "delta") {
            streamRef.current!.text += data.text || ""
            setChatMsgs(prev => {
              const next = [...prev]
              next[next.length - 1] = {
                role: "assistant",
                content: streamRef.current!.text
              }
              return next
            })
            setContent(streamRef.current!.text)
          } else if (event === "done") {
            streamRef.current = null
          }
        }
      )
      // 完成后刷新修订历史
      const revs = await api.get<
        { revision: string; content: string }[]
      >(`/api/patients/${pid}/visits/${vid}/documents/${docId}/revisions`)
      setRevisions(revs)
      toast.success("已修订")
    } catch (e: any) {
      toast.error(e.message || "对话失败")
    } finally {
      setStreaming(false)
    }
  }

  const revert = async (rev: string) => {
    if (!vid || !docId) return
    try {
      const d = await api.post<DocumentItem>(
        `/api/patients/${pid}/visits/${vid}/documents/${docId}/revert`,
        { revision: rev }
      )
      setContent(d.content || "")
      toast.success(`已回退到 ${rev}`)
    } catch (e: any) {
      toast.error(e.message || "回退失败")
    }
  }

  const exportOne = () => {
    if (!vid || !docId) return
    window.location.href = `${GI_API_BASE}/api/patients/${pid}/visits/${vid}/documents/${docId}/export`
  }

  if (!ready) {
    return <div className="text-muted-foreground p-8 text-center">加载中…</div>
  }

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            className="hover:bg-accent rounded-md p-1.5"
            onClick={() => router.push(`/gi?pid=${pid}`)}
            title="返回"
          >
            <IconArrowLeft size={18} />
          </button>
          <span className="text-base font-semibold">
            {template?.name || docType}
            {doc?.status === "已确认" && (
              <span className="bg-primary/20 text-primary ml-2 rounded px-1.5 py-0.5 text-xs">
                已确认
              </span>
            )}
          </span>
          {template && (template.variants || []).length > 0 && (
            <select
              className={inputCls + " w-auto"}
              value={templateVariant}
              onChange={e => setTemplateVariant(e.target.value)}
            >
              {(template.variants || []).map(v => (
                <option key={v.病种} value={v.病种}>
                  模板：{v.病种}
                </option>
              ))}
            </select>
          )}
          <input
            type="date"
            className={inputCls + " w-auto"}
            value={docDate}
            onChange={e => setDocDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!docId || busy}
            className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            保存
          </button>
          <button
            onClick={confirmDoc}
            disabled={!docId || busy}
            className="hover:bg-accent flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <IconCheck size={16} />
            确认
          </button>
          <button
            onClick={exportOne}
            disabled={!docId}
            className="hover:bg-accent flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <IconFileDownload size={16} />
            导出
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 左列：表单 */}
        <div className="w-96 shrink-0 overflow-y-auto border-r p-4">
          <SectionTitle>生命体征</SectionTitle>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {VITAL_FIELDS.map(v => (
              <Field key={v} label={v}>
                <input
                  className={inputCls + " h-8 px-2 text-xs"}
                  value={vitals[v] || ""}
                  onChange={e => setVitals({ ...vitals, [v]: e.target.value })}
                />
              </Field>
            ))}
          </div>

          <SectionTitle>文书要素</SectionTitle>
          <div className="mb-4 space-y-2">
            {(template?.required_fields || []).map(f => (
              <Field key={f} label={f}>
                <textarea
                  className={textareaCls}
                  rows={f === "现病史" || f === "体格检查" ? 4 : 2}
                  value={fields[f] || ""}
                  onChange={e => setFields({ ...fields, [f]: e.target.value })}
                />
              </Field>
            ))}
          </div>

          {materials.length > 0 && (
            <>
              <SectionTitle>参考材料（{docDate}）</SectionTitle>
              <div className="mb-4 flex flex-wrap gap-2">
                {materials.map(m => {
                  const active = materialIds.includes(m.material_id)
                  const mDate = m.日期 || (m.created_at || "").slice(0, 10)
                  return (
                    <button
                      key={m.material_id}
                      onClick={() =>
                        setMaterialIds(prev =>
                          active
                            ? prev.filter(x => x !== m.material_id)
                            : [...prev, m.material_id]
                        )
                      }
                      className={
                        active
                          ? "bg-primary/20 text-primary rounded-md border px-2 py-1 text-xs"
                          : "text-muted-foreground hover:bg-accent rounded-md border px-2 py-1 text-xs"
                      }
                    >
                      {m.文件名 || m.material_id}（{mDate}）
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {!docId && (
            <button
              onClick={generate}
              disabled={busy}
              className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              {busy ? "生成中…" : "生成草稿"}
            </button>
          )}
        </div>

        {/* 右列：正文 + 对话 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {warnings?.has_warnings && (
            <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-500">
              一致性提示：{warnings.warnings.length} 项数值与输入资料不一致，请核对
            </div>
          )}

          <div className="border-b p-2">
            <SectionTitle>文书正文（可编辑）</SectionTitle>
            <textarea
              className={textareaCls + " min-h-[260px]"}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="生成草稿后在此显示，可直接编辑或通过下方对话修改"
            />
          </div>

          {/* 对话修订 */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b p-2">
              <SectionTitle>对话修订</SectionTitle>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {chatMsgs.length === 0 && (
                  <div className="text-muted-foreground text-xs">
                    输入修改指令（如「把主诉改为一句话」「补充既往高血压史」），AI 会修订正文。
                  </div>
                )}
                {chatMsgs.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "text-right text-xs"
                        : "bg-accent/50 rounded-md p-2 text-xs"
                    }
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
                {streaming && (
                  <div className="text-muted-foreground text-xs">修订中…</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t p-2">
              <input
                className={inputCls}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="输入修改指令，回车发送"
                disabled={!docId || streaming}
              />
              <button
                onClick={sendChat}
                disabled={!docId || streaming || !chatInput.trim()}
                className="bg-primary text-primary-foreground rounded-md p-2 disabled:opacity-50"
              >
                <IconSend size={16} />
              </button>
            </div>
          </div>

          {/* 修订历史 */}
          {revisions.length > 1 && (
            <div className="border-t p-2">
              <SectionTitle>修订历史</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {revisions.map(r => (
                  <button
                    key={r.revision}
                    onClick={() => revert(r.revision)}
                    className="hover:bg-accent rounded-md border px-2 py-1 text-xs"
                  >
                    {r.revision}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
