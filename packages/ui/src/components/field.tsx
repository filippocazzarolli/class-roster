import { Field as FieldPrimitive } from "@base-ui/react/field"

import { cn } from "@repo/ui/lib/utils"

/**
 * Le parti di un campo di form: etichetta, controllo, descrizione, errore.
 *
 * `Field.Root` collega da sé `label`, `input` e messaggio d'errore via `aria-describedby`,
 * quindi qui non si generano `id`: farlo a mano significherebbe riscrivere — peggio — ciò
 * che la primitiva già garantisce.
 */
function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("flex flex-col items-start gap-1.5", className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn(
        "text-sm font-medium text-foreground select-none data-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

/**
 * Il messaggio d'errore.
 *
 * Senza `match` compare solo quando il campo è invalido — sia per la validazione del
 * browser, sia per gli errori passati a `<Form errors={…}>`, che è la strada per cui un
 * `TitoloCorsoGiaUsato` arrivato dall'api finisce sotto il campo giusto invece che in un
 * avviso generico in cima alla pagina.
 */
function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn("text-xs text-destructive", className)}
      {...props}
    />
  )
}

const FieldControl = FieldPrimitive.Control

export { Field, FieldControl, FieldDescription, FieldError, FieldLabel }
