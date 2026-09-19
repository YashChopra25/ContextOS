import type { Confidence, SkillCategory } from "@/lib/types"

interface SkillDefinition {
  name: string
  category: SkillCategory
  /** Matched against GitHub languages exactly (case-insensitive). */
  languages?: string[]
  /** Whole-word patterns matched against topics, repo names, descriptions, titles and queries. */
  keywords: string[]
}

/**
 * The skill taxonomy used by the Context Engine to turn raw source data into
 * structured skills, and by the agent / matcher to understand queries.
 */
export const SKILL_TAXONOMY: SkillDefinition[] = [
  { name: "TypeScript", category: "language", languages: ["TypeScript"], keywords: ["typescript"] },
  { name: "JavaScript", category: "language", languages: ["JavaScript"], keywords: ["javascript", "js", "es6"] },
  { name: "Python", category: "language", languages: ["Python", "Jupyter Notebook"], keywords: ["python"] },
  { name: "Rust", category: "language", languages: ["Rust"], keywords: ["rust", "rustlang"] },
  { name: "Go", category: "language", languages: ["Go"], keywords: ["golang"] },
  { name: "Java", category: "language", languages: ["Java"], keywords: ["java", "spring", "springboot"] },
  { name: "C++", category: "language", languages: ["C++"], keywords: ["cpp", "c\\+\\+"] },
  { name: "C", category: "language", languages: ["C"], keywords: [] },
  { name: "Kotlin", category: "language", languages: ["Kotlin"], keywords: ["kotlin"] },
  { name: "Dart", category: "language", languages: ["Dart"], keywords: ["dart"] },
  { name: "Solidity", category: "web3", languages: ["Solidity"], keywords: ["solidity"] },
  { name: "Solana", category: "web3", keywords: ["solana", "anchor", "spl", "phantom", "metaplex", "helius"] },
  { name: "Ethereum", category: "web3", keywords: ["ethereum", "evm", "hardhat", "foundry", "erc20", "erc721", "ethers", "wagmi", "viem"] },
  { name: "Web3", category: "web3", keywords: ["web3", "blockchain", "defi", "nft", "dapp", "crypto", "smart contract", "smart contracts", "wallet", "onchain"] },
  { name: "React", category: "framework", keywords: ["react", "reactjs", "react.js", "jsx"] },
  { name: "Next.js", category: "framework", keywords: ["nextjs", "next.js", "next-js"] },
  { name: "Node.js", category: "framework", keywords: ["node", "nodejs", "node.js", "express", "expressjs", "nestjs"] },
  { name: "Tailwind CSS", category: "framework", keywords: ["tailwind", "tailwindcss"] },
  { name: "Vue", category: "framework", languages: ["Vue"], keywords: ["vue", "vuejs", "nuxt"] },
  { name: "Angular", category: "framework", keywords: ["angular"] },
  { name: "Django", category: "framework", keywords: ["django"] },
  { name: "FastAPI", category: "framework", keywords: ["fastapi"] },
  { name: "Flask", category: "framework", keywords: ["flask"] },
  { name: "Flutter", category: "framework", keywords: ["flutter"] },
  { name: "React Native", category: "framework", keywords: ["react-native", "react native", "expo"] },
  { name: "Machine Learning", category: "ai", keywords: ["ml", "machine learning", "machine-learning", "deep learning", "deep-learning", "tensorflow", "pytorch", "scikit-learn", "sklearn", "keras", "data science", "data-science"] },
  { name: "LLMs & AI agents", category: "ai", keywords: ["llm", "llms", "openai", "langchain", "gpt", "rag", "ai agent", "ai agents", "agentic", "gemini", "chatbot", "genai", "generative ai", "ai"] },
  { name: "Computer Vision", category: "ai", keywords: ["computer vision", "opencv", "yolo", "image classification"] },
  { name: "Docker", category: "infra", keywords: ["docker", "dockerfile", "containers"] },
  { name: "Kubernetes", category: "infra", keywords: ["kubernetes", "k8s", "helm"] },
  { name: "AWS", category: "infra", keywords: ["aws", "lambda", "s3", "ec2"] },
  { name: "PostgreSQL", category: "infra", keywords: ["postgres", "postgresql", "prisma", "drizzle"] },
  { name: "MongoDB", category: "infra", keywords: ["mongodb", "mongo", "mongoose", "mern"] },
  { name: "Firebase", category: "infra", keywords: ["firebase", "firestore"] },
  { name: "GraphQL", category: "infra", keywords: ["graphql", "apollo"] },
  { name: "DevOps", category: "infra", keywords: ["devops", "ci/cd", "cicd", "github actions", "terraform"] },
  { name: "Cybersecurity", category: "domain", keywords: ["security", "cybersecurity", "pentest", "ctf", "vulnerability"] },
  { name: "Full-stack web", category: "domain", keywords: ["full stack", "full-stack", "fullstack", "mern", "web developer", "web development"] },
  { name: "Mobile", category: "domain", keywords: ["android", "ios", "mobile app", "mobile"] },
]

const escapeRegex = (value: string) => value.replace(/[.*?^${}()|[\]\\/]/g, "\\$&")

const COMPILED = SKILL_TAXONOMY.map((definition) => ({
  definition,
  pattern: definition.keywords.length
    ? new RegExp(
        `(^|[^a-z0-9+#])(${definition.keywords
          .map((k) => (k.includes("\\") ? k : escapeRegex(k)))
          .join("|")})(?=$|[^a-z0-9+#])`,
        "i",
      )
    : null,
  languages: new Set((definition.languages ?? []).map((l) => l.toLowerCase())),
}))

/** Normalises repo slugs like `solana-nft_minter` into matchable text. */
export function toSearchableText(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
}

/** Skill names mentioned in free text (topics, descriptions, titles or a user query). */
export function extractSkillsFromText(text: string): string[] {
  if (!text.trim()) return []
  return COMPILED.filter(({ pattern }) => pattern?.test(text)).map(({ definition }) => definition.name)
}

export function skillForLanguage(language: string | null | undefined): SkillDefinition | undefined {
  if (!language) return undefined
  const key = language.toLowerCase()
  return COMPILED.find(({ languages }) => languages.has(key))?.definition
}

export function skillDefinition(name: string): SkillDefinition | undefined {
  return SKILL_TAXONOMY.find((definition) => definition.name.toLowerCase() === name.toLowerCase())
}

export const CONFIDENCE_WEIGHT: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }

export function confidenceFromScore(score: number): Confidence {
  if (score >= 5) return "high"
  if (score >= 2.5) return "medium"
  return "low"
}

/**
 * Umbrella terms people use in questions ("frontend developers", "backend engineers") mapped to the
 * concrete skills the Context Engine extracts. Anyone with any of these skills qualifies.
 */
export const SKILL_GROUPS: { name: string; pattern: RegExp; skills: string[] }[] = [
  { name: "Frontend", pattern: /\b(front[- ]?end|ui (?:developers?|engineers?|work)|web ui|user interfaces?|ui\/ux|landing pages?|websites?|web design(?:ers?)?|ui design(?:ers?)?)\b/i, skills: ["React", "Next.js", "TypeScript", "JavaScript", "Tailwind CSS", "Vue", "Angular"] },
  { name: "Backend", pattern: /\b(back[- ]?end|server[- ]side|apis?)\b/i, skills: ["Node.js", "Python", "Java", "Go", "PostgreSQL", "MongoDB", "Django", "FastAPI"] },
  { name: "Full-stack", pattern: /\bfull[- ]?stack\b/i, skills: ["Full-stack web", "React", "Next.js", "Node.js", "TypeScript", "PostgreSQL", "MongoDB"] },
  { name: "Mobile", pattern: /\b(mobile|android|ios|app developers?)\b/i, skills: ["Flutter", "React Native", "Kotlin", "Dart", "Mobile"] },
  { name: "Data & AI", pattern: /\b(data scien\w*|data engineers?|ml engineers?|ai engineers?|ai\/ml|genai)\b/i, skills: ["Python", "Machine Learning", "LLMs & AI agents", "Computer Vision"] },
  { name: "DevOps", pattern: /\b(devops|cloud engineers?|infrastructure|sre|platform engineers?)\b/i, skills: ["Docker", "Kubernetes", "AWS", "DevOps"] },
  { name: "Blockchain", pattern: /\b(blockchain|web3|crypto|smart contracts?|dapps?)\b/i, skills: ["Solana", "Ethereum", "Solidity", "Web3", "Rust"] },
]

export function extractSkillGroups(text: string) {
  return SKILL_GROUPS.filter((group) => group.pattern.test(text)).map(({ name, skills }) => ({ name, skills }))
}
