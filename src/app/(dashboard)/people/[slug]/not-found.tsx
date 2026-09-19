import Link from "next/link"

export default function PersonNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold">This person isn&apos;t in ContextOS</h1>
      <p className="mt-1 text-sm text-muted-foreground">The link may be out of date. Search the directory or track them to build a profile.</p>
      <Link href="/people" className="mt-4 inline-block text-sm underline underline-offset-4">
        Go to People
      </Link>
    </div>
  )
}
