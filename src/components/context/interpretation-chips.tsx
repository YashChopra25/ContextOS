import { Search } from "lucide-react"

import type { QueryInterpretation } from "@/lib/types"

function Chip({ label, value, tavily = false }: { label: string; value: string; tavily?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
      {tavily ? (
        <span className="inline-flex items-center gap-0.5 text-src-web" title="Researched by Tavily">
          <Search className="size-3" />
          Tavily
        </span>
      ) : null}
    </span>
  )
}

const ROLE_LABEL = { student: "Students", intern: "Interns", engineer: "Professionals", founder: "Founders", other: "Other" } as const

/** Shows how a human question was turned into the filters that ran against the database. */
export function InterpretationChips({ interpretation: i }: { interpretation: QueryInterpretation }) {
  const chips: React.ReactNode[] = []
  if (i.skills.length) chips.push(<Chip key="skills" label="Skills" value={i.skills.join(", ")} />)
  for (const group of i.groups) chips.push(<Chip key={`group-${group.name}`} label={group.name} value={`any of ${group.skills.slice(0, 4).join(", ")}${group.skills.length > 4 ? "…" : ""}`} />)
  if (i.tavilyRole === "concept") chips.push(<Chip key="concept" label={`To build ${i.concept}`} value={i.tavilySkills.join(", ")} tavily />)
  else if (i.concept) chips.push(<Chip key="goal" label="Goal" value={i.concept} />)
  if (i.tavilyRole === "related") chips.push(<Chip key="related" label="Related, ranked higher" value={i.tavilySkills.join(", ")} tavily />)
  if (i.organizations.length) {
    chips.push(
      <Chip
        key="org"
        label="Organization"
        value={i.organizations.length === 1 ? i.organizations[0] : `${i.organizationQuery} (${i.organizations.length} names)`}
      />,
    )
  }
  if (i.roles.length) chips.push(<Chip key="roles" label="Role" value={i.roles.map((r) => ROLE_LABEL[r]).join(", ")} />)
  if (i.activity) chips.push(<Chip key="activity" label="Activity" value={i.activity === "high" ? "High" : "Medium or higher"} />)
  if (i.hackathon) chips.push(<Chip key="hackathon" label="Hackathons" value={i.hackathon === "award" ? "Won an award" : "Has participated"} />)
  if (i.membership) chips.push(<Chip key="membership" label="Membership" value={i.membership === "tracked" ? "Tracked" : "Platform members"} />)
  if (!chips.length) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="How the question was interpreted">
      <span className="text-xs text-muted-foreground">Understood as</span>
      {chips}
    </div>
  )
}
