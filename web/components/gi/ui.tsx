"use client"

import { cn } from "@/lib/utils"
import { ReactNode } from "react"

export function Card({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-border bg-card text-card-foreground rounded-lg border p-4",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  children,
  className
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function SectionTitle({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h3 className={cn("mb-2 text-sm font-semibold", className)}>{children}</h3>
  )
}

export function Empty({ text }: { text?: string }) {
  return (
    <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
      {text || "暂无数据"}
    </div>
  )
}

export const inputCls =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:none flex h-9 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"

export const textareaCls =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
