"use client"

import Link from "next/link"
import { Menu } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { NavLinks } from "./app-sidebar"
import { Logo } from "./logo"
import { ThemeToggle } from "./theme-toggle"

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
      <Link href="/">
        <Logo />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Open navigation" />}>
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-5 mt-1 px-1">
            <Logo />
          </div>
          <div className="pl-3">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <div className="mt-6 flex items-center justify-between px-1 text-xs text-muted-foreground">
            Theme
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
