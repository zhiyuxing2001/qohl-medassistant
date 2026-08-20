import { i18nRouter } from "next-i18n-router"
import { NextResponse, type NextRequest } from "next/server"
import i18nConfig from "./i18nConfig"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locales = i18nConfig.locales

  // 应用入口统一重定向到医疗工作台，不再展示 chatbot-ui 原生落地页
  if (pathname === "/" || locales.some(l => pathname === `/${l}`)) {
    return NextResponse.redirect(new URL("/gi", request.url))
  }

  const i18nResult = i18nRouter(request, i18nConfig)
  if (i18nResult) return i18nResult

  // 本地模式：不做 Supabase 会话校验，直接放行
  return NextResponse.next()
}

export const config = {
  matcher: "/((?!api|static|.*\\..*|_next|auth|gi).*)"
}
