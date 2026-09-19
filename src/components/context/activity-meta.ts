import { Award, FileCode2, GraduationCap, MessageSquare, Trophy, UserPlus, Users } from "lucide-react"

import type { ActivityType } from "@/lib/types"

export const ACTIVITY_META: Record<ActivityType, { label: string; icon: typeof Users }> = {
  joined: { label: "Joined", icon: UserPlus },
  hackathon: { label: "Hackathon", icon: Trophy },
  submission: { label: "Submission", icon: FileCode2 },
  team: { label: "Team", icon: Users },
  comment: { label: "Comment", icon: MessageSquare },
  mentorship: { label: "Mentorship", icon: GraduationCap },
  award: { label: "Award", icon: Award },
}
