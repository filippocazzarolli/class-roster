import { Form as FormPrimitive } from "@base-ui/react/form"

import { cn } from "@repo/ui/lib/utils"

/**
 * Il `<form>`, con la raccolta degli errori.
 *
 * La prop `errors` prende un oggetto indicizzato per `name` del campo: è il punto in cui
 * un errore di dominio arrivato dall'api — `HttpError.error` — diventa un messaggio sotto
 * il campo che l'ha causato. Il frontend non decide *se* il valore è valido, riporta la
 * risposta di chi lo decide.
 */
function Form<
  FormValues extends Record<string, unknown> = Record<string, unknown>,
>({
  className,
  ...props
}: FormPrimitive.Props<FormValues>) {
  return (
    <FormPrimitive
      data-slot="form"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

export { Form }
