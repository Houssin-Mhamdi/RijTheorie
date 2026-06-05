import { useMemo } from "react"
import { useForm as useHookForm, type UseFormProps, type UseFormReturn, type FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { type z } from "zod"

export function useZodForm<T extends FieldValues = FieldValues>({
  schema,
  ...formOptions
}: UseFormProps<T> & { schema: z.ZodType<T> }): UseFormReturn<T> {
  const resolver = useMemo(() => zodResolver(schema as never), [schema])

  return useHookForm<T>({
    resolver: resolver as never,
    ...formOptions,
  })
}
