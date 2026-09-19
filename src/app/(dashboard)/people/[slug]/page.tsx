import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { GithubSection } from "@/features/profile/components/github-section"
import { OverviewSection } from "@/features/profile/components/overview-section"
import { PlatformActivitySection } from "@/features/profile/components/platform-activity"
import { ProfileHeader } from "@/features/profile/components/profile-header"
import { ProjectsSection } from "@/features/profile/components/projects-section"
import { SignalsSection } from "@/features/profile/components/signals-section"
import { SkillsSection } from "@/features/profile/components/skills-section"
import { getPersonProfile, getPersonRow } from "@/server/repository/people"

export async function generateMetadata({ params }: PageProps<"/people/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const person = await getPersonRow(slug)
  return { title: person?.fullName ?? "Person not found" }
}

export default async function PersonPage({ params }: PageProps<"/people/[slug]">) {
  const { slug } = await params
  const person = await getPersonProfile(slug)
  if (!person) notFound()

  return (
    <>
      <Link href="/people" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" />
        People
      </Link>
      <ProfileHeader person={person} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <OverviewSection person={person} />
          <SkillsSection skills={person.skills} />
          <ProjectsSection projects={person.projects} />
          <GithubSection github={person.github} username={person.githubUsername} />
          <PlatformActivitySection activity={person.activity} hackathons={person.hackathons} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <SignalsSection signals={person.signals} />
        </aside>
      </div>
    </>
  )
}
