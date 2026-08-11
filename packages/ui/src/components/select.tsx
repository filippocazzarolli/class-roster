import { Field as FieldPrimitive } from "@base-ui/react/field"

import { cn } from "@repo/ui/lib/utils"

/**
 * Una scelta fra poche alternative note.
 *
 * È il `<select>` nativo reso da `Field.Control`, non il `Select` di Base UI: quello è un
 * popup costruito con `div` e serve quando l'aspetto della tendina va controllato. Qui le
 * opzioni sono due o tre valori chiusi di un contratto — il tipo di luogo, il motivo di un
 * annullamento — e il controllo nativo li apre con la tastiera, li cerca digitando e sul
 * telefono usa la ruota di sistema, senza che nulla di tutto ciò vada riscritto.
 */
function Select({
  className,
  children,
  ...props
}: Omit<FieldPrimitive.Control.Props, "render">) {
  return (
    <FieldPrimitive.Control
      data-slot="select"
      render={<select />}
      className={cn(
        "h-8 w-full appearance-none rounded-lg border border-border bg-background bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat py-0 pr-8 pl-2.5 text-sm text-foreground transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"gray\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\"/></svg>')]",
        className
      )}
      {...props}
    >
      {children}
    </FieldPrimitive.Control>
  )
}

export { Select }
