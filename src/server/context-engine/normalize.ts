/** Identity resolution helpers: cleaning raw registration data into a consistent identity. */

const EMPTY_VALUES = new Set(["", "na", "n/a", "none", "null", "-", "nil", "no"])

export function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim()
  return EMPTY_VALUES.has(trimmed.toLowerCase()) ? null : trimmed
}

/** Title-cases names typed in all-lower case; leaves anything with capitals (e.g. "IIITD") alone. */
export function normalizeName(value: string | null | undefined): string | null {
  const name = clean(value)
  if (!name) return null
  if (name !== name.toLowerCase()) return name
  return name
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const TITLE_ALIASES: Record<string, string> = {
  student: "Student",
  students: "Student",
  "as an intern": "Intern",
  intern: "Intern",
  "sde intern": "SDE Intern",
  "software developer": "Software Developer",
  "software engineer": "Software Engineer",
  "ai engineer": "AI Engineer",
  founder: "Founder",
  "co-founder": "Co-founder",
  cofounder: "Co-founder",
}

export function normalizeTitle(value: string | null | undefined): string | null {
  const title = clean(value)
  if (!title) return null
  return TITLE_ALIASES[title.toLowerCase()] ?? title
}

export type RoleCategory = "student" | "intern" | "engineer" | "founder" | "other"

export function roleCategory(title: string | null): RoleCategory {
  const t = (title ?? "").toLowerCase()
  if (/founder|ceo|cto|coo/.test(t)) return "founder"
  if (/intern/.test(t)) return "intern"
  if (/student|undergrad|b\.?tech|fresher/.test(t)) return "student"
  if (/engineer|developer|sde|programmer|architect|scientist|analyst|designer|lead/.test(t)) return "engineer"
  return "other"
}

/** Organization is meaningless when it just repeats "Student". */
export function normalizeOrganization(value: string | null | undefined): string | null {
  const org = clean(value)
  if (!org || /^students?$/i.test(org)) return null
  return org
}

/** Accepts `octocat`, `@octocat`, `github.com/octocat` or a full URL. */
export function parseGithubUsername(value: string | null | undefined): string | null {
  const raw = clean(value)
  if (!raw) return null
  const match = raw.match(/github\.com\/([A-Za-z0-9-]{1,39})/i)
  const candidate = (match ? match[1] : raw.replace(/^@/, "")).trim()
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(candidate) ? candidate : null
}

export function normalizeLinkedinUrl(value: string | null | undefined): string | null {
  const raw = clean(value)
  if (!raw) return null
  const match = raw.match(/linkedin\.com\/in\/([^/?#\s]+)/i)
  return match ? `https://www.linkedin.com/in/${match[1]}` : null
}

export function normalizeUrl(value: string | null | undefined): string | null {
  const raw = clean(value)
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return url.hostname.includes(".") ? url.toString() : null
  } catch {
    return null
  }
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export function joinName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ")
}
