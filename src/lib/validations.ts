import { z } from "zod"

export const emailSchema = z.email("Invalid email address")

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")

export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters")

export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s()-]{7,20}$/, "Invalid phone number")

export const urlSchema = z.url("Invalid URL")

export const uuidSchema = z.uuid("Invalid UUID")

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

export function createFormSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape)
}

export type InferFormSchema<T extends z.ZodObject<z.ZodRawShape>> = z.infer<T>
