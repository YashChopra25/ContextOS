import { cn } from "@/lib/utils"

export function ProfileSection({
  id,
  title,
  meta,
  children,
  className,
}: {
  id: string
  title: string
  meta?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20 rounded-xl border bg-card", className)}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 id={`${id}-title`} className="text-sm font-medium">
          {title}
        </h2>
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>
}
