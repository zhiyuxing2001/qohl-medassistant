import { NextResponse, type NextRequest } from "next/server"
import { createClient as createLocalClient } from "./local-adapter"

// 不再拦截请求：返回一个直接放行的 response，并附带本地 supabase 客户端。
export const createClient = (request: NextRequest) => {
  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  return {
    supabase: createLocalClient(),
    response
  }
}
