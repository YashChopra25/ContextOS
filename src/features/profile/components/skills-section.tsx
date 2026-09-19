import { ConfidenceMeter } from "@/components/context/confidence-meter"
import { EvidencePopover } from "@/components/context/evidence-popover"
import type { Skill, SkillCategory } from "@/lib/types"
import { EmptyNote, ProfileSection } from "./profile-section"

const CATEGORY: Record<SkillCategory, string> = {
  language: "Language",
  framework: "Framework",
  web3: "Web3",
  ai: "AI & ML",
  infra: "Infrastructure",
  domain: "Domain",
}

export function SkillsSection({ skills }: { skills: Skill[] }) {
  return (
    <ProfileSection id="skills" title="Technical skills" meta="Confidence reflects how much evidence supports each skill">
      {skills.length ? (
        <ul className="divide-y">
          {skills.map((skill) => (
            <li key={skill.name} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium">{skill.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{CATEGORY[skill.category]}</span>
              </span>
              <ConfidenceMeter confidence={skill.confidence} className="w-24" />
              <EvidencePopover evidence={skill.evidence} title={`Evidence for ${skill.name}`} className="w-14 justify-end" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote>No skills extracted yet. Sync their GitHub or add platform activity.</EmptyNote>
      )}
    </ProfileSection>
  )
}
