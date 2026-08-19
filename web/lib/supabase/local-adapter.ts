/**
 * 本地适配器：用 localStorage（浏览器）或内存（服务端）模拟 supabase-js 的
 * 查询链与 auth，使 chatbot-ui 不再依赖 Supabase 服务即可启动运行。
 *
 * 支持被 db/*.ts 实际用到的链式调用：
 *   .from(table).select(cols).eq().neq().in().order().limit()
 *     .maybeSingle().single().insert().update().delete().upsert()
 * 以及极简的 .auth 与 .storage。
 */

export const LOCAL_USER_ID = "local-user"
export const LOCAL_WORKSPACE_ID = "local-workspace"
export const LOCAL_DB_KEY = "gi_local_db"

type Row = Record<string, any>
type Store = Record<string, Row[]>

const isBrowser = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined"

// 服务端内存存储（每请求一个实例即可，仅用于读取默认 profile/workspace）
let memoryStore: Store | null = null

// ---------------------------------------------------------------- 默认数据
function defaultProfile(): Row {
  return {
    id: LOCAL_USER_ID,
    user_id: LOCAL_USER_ID,
    username: "doctor",
    display_name: "医生",
    bio: "",
    profile_context: "",
    image_path: "",
    image_url: "",
    has_onboarded: true,
    created_at: new Date().toISOString(),
    updated_at: null,
    openai_api_key: null,
    openai_organization_id: null,
    anthropic_api_key: null,
    google_gemini_api_key: null,
    mistral_api_key: null,
    groq_api_key: null,
    perplexity_api_key: null,
    openrouter_api_key: null,
    use_azure_openai: false,
    azure_openai_api_key: null,
    azure_openai_endpoint: null,
    azure_openai_35_turbo_id: null,
    azure_openai_45_turbo_id: null,
    azure_openai_45_vision_id: null,
    azure_openai_embeddings_id: null
  }
}

function defaultWorkspace(): Row {
  return {
    id: LOCAL_WORKSPACE_ID,
    user_id: LOCAL_USER_ID,
    name: "本地工作区",
    description: "",
    default_model: "gpt-4-1106-preview",
    default_prompt: "You are a friendly, helpful AI assistant.",
    default_temperature: 0.5,
    default_context_length: 4096,
    embeddings_provider: "openai",
    include_profile_context: true,
    include_workspace_instructions: true,
    instructions: "",
    image_path: "",
    sharing: "private",
    is_home: true,
    created_at: new Date().toISOString(),
    updated_at: null
  }
}

function defaultStore(): Store {
  return {
    profiles: [defaultProfile()],
    workspaces: [defaultWorkspace()]
  }
}

// ---------------------------------------------------------------- 存储读写
function loadStore(): Store {
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(LOCAL_DB_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return ensureDefaults(parsed)
        }
      }
    } catch (e) {
      // ignore parse errors, fall through to reseed
    }
    const store = defaultStore()
    persistStore(store)
    return store
  }

  if (!memoryStore) {
    memoryStore = defaultStore()
  }
  return memoryStore
}

function persistStore(store: Store) {
  if (isBrowser()) {
    try {
      window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(store))
    } catch (e) {
      // quota exceeded etc. — non-fatal
    }
  } else {
    memoryStore = store
  }
}

// 保证默认 profile / workspace 恒存在，避免 .single() 抛错
function ensureDefaults(store: Store): Store {
  const out: Store = { ...store }
  if (!Array.isArray(out.profiles)) out.profiles = []
  if (!Array.isArray(out.workspaces)) out.workspaces = []

  if (!out.profiles.some(p => p.user_id === LOCAL_USER_ID)) {
    out.profiles.push(defaultProfile())
  }
  if (!out.workspaces.some(w => w.id === LOCAL_WORKSPACE_ID)) {
    out.workspaces.push(defaultWorkspace())
  }
  return out
}

function readTable(table: string): Row[] {
  const store = loadStore()
  if (!store[table]) {
    store[table] = []
    persistStore(store)
  }
  return store[table]
}

function writeTable(table: string, rows: Row[]) {
  const store = loadStore()
  store[table] = rows
  persistStore(store)
}

// ---------------------------------------------------------------- 过滤匹配
function matches(row: Row, col: string, val: any): boolean {
  // 宽松比较：字符串/数字/布尔，忽略大小写差异
  const rowVal = row[col]
  if (rowVal === val) return true
  if (rowVal == null && val == null) return true
  return String(rowVal) === String(val)
}

// ---------------------------------------------------------------- 查询链
type Result = { data: any; error: any }

type Op = "select" | "insert" | "update" | "delete" | "upsert"

class QueryBuilder {
  private table: string
  private op: Op = "select"
  private payload: Row[] | Row | null = null
  private filters: Array<(row: Row) => boolean> = []
  private orderSpecs: Array<{ field: string; ascending: boolean }> = []
  private limitCount: number | null = null
  private singleMode: "none" | "maybe" | "single" = "none"
  private returnData: boolean = false

  constructor(table: string) {
    this.table = table
  }

  select(_columns?: string): this {
    this.returnData = true
    return this
  }

  eq(col: string, val: any): this {
    this.filters.push(row => matches(row, col, val))
    return this
  }

  neq(col: string, val: any): this {
    this.filters.push(row => !matches(row, col, val))
    return this
  }

  in(col: string, vals: any[]): this {
    const list = Array.isArray(vals) ? vals : []
    this.filters.push(row => list.some(v => matches(row, col, v)))
    return this
  }

  order(field: string, opts?: { ascending?: boolean }): this {
    this.orderSpecs.push({ field, ascending: opts?.ascending !== false })
    return this
  }

  limit(n: number): this {
    this.limitCount = n
    return this
  }

  maybeSingle(): this {
    this.singleMode = "maybe"
    this.returnData = true
    return this
  }

  single(): this {
    this.singleMode = "single"
    this.returnData = true
    return this
  }

  insert(rows: Row[] | Row): this {
    this.op = "insert"
    this.payload = rows
    return this
  }

  upsert(rows: Row[] | Row): this {
    this.op = "upsert"
    this.payload = rows
    return this
  }

  update(obj: Row): this {
    this.op = "update"
    this.payload = obj
    return this
  }

  delete(): this {
    this.op = "delete"
    return this
  }

  // 使 builder 可 await：await builder -> { data, error }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute(): Result {
    try {
      let rows = readTable(this.table)

      switch (this.op) {
        case "insert": {
          const inserts = Array.isArray(this.payload)
            ? this.payload
            : [this.payload].filter(Boolean)
          const created = inserts.map(r => ({ ...r }))
          rows = [...rows, ...created]
          writeTable(this.table, rows)
          return this.finish(created)
        }
        case "upsert": {
          const upserts = Array.isArray(this.payload)
            ? this.payload
            : [this.payload].filter(Boolean)
          const upserted: Row[] = []
          const next = [...rows]
          for (const u of upserts) {
            const idx = next.findIndex(r => r.id && u.id && r.id === u.id)
            if (idx >= 0) {
              next[idx] = { ...next[idx], ...u }
              upserted.push(next[idx])
            } else {
              next.push({ ...u })
              upserted.push(next[next.length - 1])
            }
          }
          writeTable(this.table, next)
          return this.finish(upserted)
        }
        case "update": {
          const matched = rows.filter(r => this.filters.every(f => f(r)))
          const updateObj = (this.payload || {}) as Row
          for (const r of matched) {
            Object.assign(r, updateObj)
          }
          writeTable(this.table, rows)
          return this.finish(matched)
        }
        case "delete": {
          const matched = rows.filter(r => this.filters.every(f => f(r)))
          const remaining = rows.filter(r => !this.filters.every(f => f(r)))
          writeTable(this.table, remaining)
          return { data: null, error: null }
        }
        case "select":
        default: {
          return this.finish(rows)
        }
      }
    } catch (e) {
      return { data: null, error: e }
    }
  }

  private finish(source: Row[]): Result {
    let rows = source.filter(r => this.filters.every(f => f(r)))

    for (const spec of this.orderSpecs) {
      const { field, ascending } = spec
      rows = [...rows].sort((a, b) => {
        const av = a[field]
        const bv = b[field]
        if (av == null && bv == null) return 0
        if (av == null) return ascending ? -1 : 1
        if (bv == null) return ascending ? 1 : -1
        if (av < bv) return ascending ? -1 : 1
        if (av > bv) return ascending ? 1 : -1
        return 0
      })
    }

    if (this.limitCount != null) {
      rows = rows.slice(0, this.limitCount)
    }

    if (this.singleMode === "single") {
      if (rows.length === 0) {
        return { data: null, error: new Error("No rows found") }
      }
      if (rows.length > 1) {
        return { data: null, error: new Error("More than one row found") }
      }
      return { data: rows[0], error: null }
    }
    if (this.singleMode === "maybe") {
      return {
        data: rows.length > 0 ? rows[0] : null,
        error: null
      }
    }

    return { data: rows, error: null }
  }
}

// ---------------------------------------------------------------- auth 桩
const localUser = {
  id: LOCAL_USER_ID,
  email: "doctor@local",
  user_metadata: {},
  app_metadata: { provider: "local" },
  aud: "authenticated",
  created_at: new Date().toISOString()
}

const localSession = {
  access_token: "local-token",
  refresh_token: "local-refresh",
  expires_at: 9999999999,
  user: localUser
}

const auth = {
  async getSession() {
    return { data: { session: localSession }, error: null }
  },
  async getUser() {
    return { data: { user: localUser }, error: null }
  },
  async signInWithPassword() {
    return { data: { user: localUser, session: localSession }, error: null }
  },
  async signUp() {
    return { data: { user: localUser, session: localSession }, error: null }
  },
  async signOut() {
    return { error: null }
  },
  async updateUser(_attrs?: any) {
    return { data: { user: localUser }, error: null }
  },
  async resetPasswordForEmail() {
    return { error: null }
  },
  async exchangeCodeForSession(_code?: string) {
    return { data: { session: localSession }, error: null }
  },
  onAuthStateChange(_cb: (event: string, session: any) => void) {
    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    }
  }
}

// ---------------------------------------------------------------- storage 桩
function storageBucket() {
  return {
    async upload(path: string, _file?: any, _opts?: any) {
      return { data: { path }, error: null }
    },
    async remove(paths: string[]) {
      return { error: null }
    },
    getPublicUrl(path: string) {
      // supabase-js 的 getPublicUrl 是同步方法
      return { data: { publicUrl: "" }, error: null }
    },
    async createSignedUrl(path: string, _expiresIn?: number, _opts?: any) {
      return { data: { signedUrl: "" }, error: null }
    },
    async download(path: string) {
      return { data: null, error: null }
    }
  }
}

const storage = {
  from(_bucket?: string) {
    return storageBucket()
  }
}

// ---------------------------------------------------------------- 顶层对象
class LocalClient {
  from(table: string) {
    return new QueryBuilder(table)
  }

  rpc(_fn: string, _args?: Record<string, any>): any {
    // 无真实 RPC；返回成功，调用方据此继续执行
    return Promise.resolve({ data: null, error: null })
  }

  auth = auth
  storage = storage
}

// 兼容 supabase-js 的导出
export const supabase = new LocalClient()

export function createClient(): LocalClient {
  return new LocalClient()
}

export function createBrowserClient(): LocalClient {
  return new LocalClient()
}

export function createServerClient(): LocalClient {
  return new LocalClient()
}
