import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

/**
 * Un'etichetta breve accanto a ciò che qualifica.
 *
 * Le varianti hanno nomi di **tono** — `neutral`, `positive`, `warning` — e non di
 * significato: un `variant="pubblicato"` porterebbe il dominio dentro `ui`, che §4.11
 * vuole ignorante di dominio. È chi la usa a sapere che «Pubblicato» è positivo.
 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        positive: "bg-primary/10 text-primary",
        warning:
          "bg-amber-500/10 text-amber-700 dark:text-amber-500",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
