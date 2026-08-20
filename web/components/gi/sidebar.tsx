"use client"

import {
  IconMoon,
  IconReportMedical,
  IconStethoscope,
  IconSun,
  IconTemplate,
  IconUsers
} from "@tabler/icons-react"
import { useTheme } from "next-themes"

export type Module = "patients" | "cases" | "templates"

const ITEMS: { key: Module; label: string; icon: any }[] = [
  { key: "patients", label: "患者列表", icon: IconUsers },
  { key: "cases", label: "病例库", icon: IconReportMedical },
  { key: "templates", label: "病历模板", icon: IconTemplate }
]

export function Sidebar({
  active,
  onSelect,
  patientLabel
}: {
  active: Module
  onSelect: (m: Module) => void
  patientLabel?: string
}) {
  const { theme, setTheme } = useTheme()
  const dark = theme === "dark"

  return (
    <aside className="bg-card flex w-56 shrink-0 flex-col border-r">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <IconStethoscope size={22} className="text-primary" />
        <span className="text-base font-semibold">临床助手</span>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {ITEMS.map(it => {
          const Icon = it.icon
          const isActive = active === it.key
          return (
            <button
              key={it.key}
              onClick={() => onSelect(it.key)}
              className={
                (isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground") +
                " flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium"
              }
            >
              <Icon size={18} />
              {it.label}
            </button>
          )
        })}
      </nav>

      {patientLabel && (
        <div className="text-muted-foreground border-t px-4 py-2.5 text-xs">
          当前患者：<span className="text-foreground font-medium">{patientLabel}</span>
        </div>
      )}

      <div className="border-t p-2">
        <button
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm"
        >
          {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
          {dark ? "浅色模式" : "深色模式"}
        </button>
      </div>
    </aside>
  )
}
