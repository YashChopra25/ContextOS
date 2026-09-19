"use client"

import { Monitor, Moon, Sun } from "lucide-react"

import { useTheme, type Theme } from "@/components/theme/theme-provider"
import { cn } from "@/lib/utils"

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-md border bg-background p-0.5", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "grid size-6 place-items-center rounded-[5px] text-muted-foreground hover:text-foreground",
            theme === value && "bg-muted text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  )
}
