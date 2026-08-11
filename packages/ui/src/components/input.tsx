import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@repo/ui/lib/utils"

/**
 * Il campo di testo su una riga.
 *
 * `@base-ui/react/input` invece di un `<input>` nudo perché dentro un `Field.Root` si
 * registra da solo: stato `touched`, `dirty` e `aria-invalid` arrivano dalla primitiva, e
 * lo stile qui sotto si limita a leggerli.
 */
function Input({ className, ...props }: InputPrimitive.Props) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
