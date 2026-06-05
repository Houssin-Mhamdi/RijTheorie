import type { Control, FieldPath, FieldValues } from "react-hook-form"
import { FormField as FormFieldBase, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form"

type FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  placeholder?: string
  children: React.ReactNode
}

export function FormFieldAdapter<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ control, name, label, description, children }: FormFieldProps<TFieldValues, TName>) {
  return (
    <FormFieldBase
      control={control}
      name={name}
      render={() => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>{children}</FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
