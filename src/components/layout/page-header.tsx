import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function SectionHeading({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="text-sm font-medium">{title}</h2>
      {action}
    </div>
  )
}
