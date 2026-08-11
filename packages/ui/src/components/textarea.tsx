import { Field as FieldPrimitive } from "@base-ui/react/field"

import { cn } from "@repo/ui/lib/utils"

/**
 * Il campo di testo su più righe.
 *
 * Base UI non ha una primitiva `Textarea`: si passa da `Field.Control` con `render`, che è
 * lo stesso meccanismo di `Input` — il controllo resta agganciato al `Field.Root` che lo
 * contiene, e cambia solo l'elemento reso.
 */
function Textarea({
  className,
  ...props
}: Omit<FieldPrimitive.Control.Props, "render">) {
  return (
    <FieldPrimitive.Control
      data-slot="textarea"
      render={<textarea />}
      className={cn(
        "field-sizing-content min-h-16 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
