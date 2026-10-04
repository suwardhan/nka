import type { ReactNode } from 'react'

type AdminHeaderProps = {
  title: string
  actions?: ReactNode
}

export function AdminHeader({ title, actions }: AdminHeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="Narendra Ahirrao and Associates"
            className="h-8 w-auto shrink-0"
          />
          <div>
            <p className="text-sm text-muted-foreground">
              Narendra Ahirrao and Associates
            </p>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          </div>
        </div>
        {actions}
      </div>
    </header>
  )
}
