import { createClient as createLocalClient } from "./local-adapter"

// 服务端与原浏览器端返回同一个本地适配器实例；
// cookieStore 参数仅为兼容原签名，实际不使用。
export const createClient = (_cookieStore?: any) => createLocalClient()
