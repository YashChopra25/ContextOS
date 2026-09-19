import { ArrowUpRight } from "lucide-react"

import { SampleTag } from "@/components/context/sample-tag"
import { SOURCE_LABEL, SourceIcon } from "@/components/context/source-icon"
import { formatDate } from "@/lib/format"
import type { Project } from "@/lib/types"
import { EmptyNote, ProfileSection } from "./profile-section"

export function ProjectsSection({ projects }: { projects: Project[] }) {
  return (
    <ProfileSection id="projects" title="Projects" meta={projects.length ? `${projects.length} total` : undefined}>
      {projects.length ? (
        <ul className="grid gap-3 py-1 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-col rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                {project.url ? (
                  <a href={project.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                    {project.name}
                    <ArrowUpRight className="size-3.5 text-muted-foreground" />
                  </a>
                ) : (
                  <span className="text-sm font-medium">{project.name}</span>
                )}
                {project.isSample ? <SampleTag /> : null}
              </div>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{project.description ?? "No description."}</p>
              {project.technologies.length ? (
                <p className="mt-2 flex flex-wrap gap-1">
                  {project.technologies.map((tech) => (
                    <span key={tech} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                      {tech}
                    </span>
                  ))}
                </p>
              ) : null}
              <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <SourceIcon source={project.source} className="size-3" />
                  {project.hackathon ?? SOURCE_LABEL[project.source]}
                </span>
                <span>{formatDate(project.date, { day: false })}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote>No projects yet.</EmptyNote>
      )}
    </ProfileSection>
  )
}
