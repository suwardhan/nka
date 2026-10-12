import { Copyright } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AdminHeaderProps = {
  title: string
  actions?: ReactNode
}

export function AdminHeader({ title, actions }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/dashboard" className="shrink-0">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt="Narendra Ahirrao and Associates"
              className="h-5 w-auto"
            />
          </Link>
          <h1 className="truncate text-base font-semibold tracking-tight">
            {title}
          </h1>
        </div>
        {actions}
      </div>
    </header>
  )
}

export function AdminShell({
  title,
  actions,
  children,
}: AdminHeaderProps & { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <AdminHeader title={title} actions={actions} />
      <div className="flex-1">{children}</div>
      <footer className="border-t bg-background">
        <p className="mx-auto flex max-w-6xl items-center justify-center gap-1.5 px-4 py-2 text-xs text-muted-foreground">
          <Copyright className="size-3 shrink-0" aria-hidden="true" />
          Narendra Ahirrao and Associates
        </p>
      </footer>
    </div>
  )
}
