/**
 * 医疗工作区后端 API 客户端（http://localhost:8100）。
 * 可用环境变量 NEXT_PUBLIC_GI_API 覆盖 BASE。
 */

export const GI_API_BASE =
  process.env.NEXT_PUBLIC_GI_API || "http://localhost:8100"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${GI_API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  })

  if (!res.ok) {
    let message = `请求失败 (${res.status})`
    try {
      const body = await res.json()
      if (body && typeof body.detail === "string") message = body.detail
      else if (body && body.detail) message = JSON.stringify(body.detail)
      else if (body && body.message) message = body.message
    } catch (e) {
      // ignore
    }
    throw new ApiError(message, res.status)
  }

  return (await res.json()) as T
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T = any>(path: string) => request<T>(path, { method: "DELETE" }),

  // SSE 流式请求（文书对话修订）
  stream: async (
    path: string,
    body: any,
    onEvent: (event: string, data: any) => void
  ) => {
    const url = `${GI_API_BASE}${path}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })

    if (!res.ok || !res.body) {
      let message = `请求失败 (${res.status})`
      try {
        const j = await res.json()
        if (j && j.detail) message = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)
      } catch (e) {}
      throw new ApiError(message, res.status)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder("utf-8")
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 以空行分隔事件块
      let idx: number
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6)
            try {
              const data = JSON.parse(payload)
              onEvent(data.event, data)
            } catch (e) {
              // 忽略非 JSON 行
            }
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 类型定义
export type Patient = {
  patient_id: string
  脱敏编号: string
  性别?: string | null
  年龄?: number | null
  体重?: number | null
  过敏史?: string
  既往史?: string
  家族史?: string
  备注?: string
  created_at?: string
  updated_at?: string
  [k: string]: any
}

export type Visit = {
  visit_id: string
  住院号: string
  入院日期?: string | null
  出院日期?: string | null
  状态: string
  主诉?: string
  现病史?: string
  体格检查?: string
  入院诊断?: string
  出院诊断?: string
  备注?: string
  created_at?: string
  updated_at?: string
  [k: string]: any
}

export type DocumentItem = {
  doc_id: string
  doc_type: string
  doc_date: string
  status: string
  summary?: string
  prompt_version?: string
  extra?: Record<string, string>
  vitals?: Record<string, string>
  content?: string
  preview?: string
  created_at?: string
  updated_at?: string
  [k: string]: any
}

export type Material = {
  material_id: string
  文件名?: string
  类型?: string
  日期?: string
  解析结果?: Record<string, any>
  置信度?: number
  created_at?: string
  [k: string]: any
}

export type TimelineItem = {
  date: string
  kind: string
  item: Record<string, any>
}

export type Suggestion = {
  suggestion_id: string
  type: string
  content: {
    检查建议?: string[]
    治疗建议?: string[]
    用药调整?: string[]
    随访计划?: string[]
    风险与注意?: string[]
    资料缺口?: string[]
    [k: string]: any
  }
  status?: string
  created_at?: string
  [k: string]: any
}

export type Template = {
  code: string
  name: string
  phase: string
  sort: number
  prompt_file: string
  required_fields: string[]
  is_active: boolean
  template: string
  examples: Example[]
  [k: string]: any
}

export type Example = {
  example_id: string
  content: string
  source?: string
  anonymized?: boolean
  is_active?: boolean
  created_at?: string
  [k: string]: any
}

export const KIND_LABEL: Record<string, string> = {
  labs: "检验",
  imaging: "影像",
  endoscopy: "内镜",
  meds: "用药"
}
