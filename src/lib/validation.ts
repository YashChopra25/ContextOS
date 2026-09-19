import { z } from "zod"

const optionalUrl = (host: RegExp, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional()
    .refine((value) => !value || host.test(value), { message })

export const SOURCE_REQUIRED = "Add at least one professional source"

/** Shared by the Add & Track form (client) and /api/track (server). */
export const trackPersonSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the person's full name").max(120),
    githubUrl: optionalUrl(/^(https?:\/\/)?(www\.)?github\.com\/[A-Za-z0-9-]{1,39}\/?$/i, "Use a profile URL like github.com/username"),
    linkedinUrl: optionalUrl(/^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/in\/[^/\s]+\/?$/i, "Use a profile URL like linkedin.com/in/name"),
    portfolioUrl: optionalUrl(/^(https?:\/\/)?[^\s/$.?#].[^\s]*\.[a-z]{2,}(\/[^\s]*)?$/i, "Enter a valid website URL"),
  })
  .refine((value) => value.githubUrl || value.linkedinUrl || value.portfolioUrl, {
    message: SOURCE_REQUIRED,
    path: ["githubUrl"],
  })

export type TrackPersonInput = z.infer<typeof trackPersonSchema>

export const agentQuerySchema = z.object({
  query: z.string().trim().min(2, "Ask a question").max(500),
  /** Person discussed in the previous turn, so "What has Yash built?" resolves to the same Yash. */
  focusSlug: z.string().trim().max(120).optional(),
})

export const matchQuerySchema = z.object({
  brief: z.string().trim().min(3, "Describe who you're looking for").max(500),
})
