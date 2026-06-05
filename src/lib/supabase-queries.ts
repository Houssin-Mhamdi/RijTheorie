import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query"
import { supabase } from "./supabase"
import type { PostgrestError } from "@supabase/supabase-js"

type QueryResult<T> = { data: T | null; error: PostgrestError | null }

export function useSupabaseQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<QueryResult<T>>,
  options?: Omit<UseQueryOptions<T, PostgrestError>, "queryKey" | "queryFn">,
) {
  return useQuery<T, PostgrestError>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await queryFn()
      if (error) throw error
      return data as T
    },
    ...options,
  })
}

export function useSupabaseMutation<TVariables, TResponse>(
  mutationFn: (variables: TVariables) => Promise<{ data: TResponse | null; error: PostgrestError | null }>,
  options?: Omit<UseMutationOptions<TResponse, PostgrestError, TVariables>, "mutationFn">,
) {
  const queryClient = useQueryClient()

  return useMutation<TResponse, PostgrestError, TVariables>({
    mutationFn: async (variables) => {
      const { data, error } = await mutationFn(variables)
      if (error) throw error
      return data as TResponse
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries()
      options?.onSuccess?.(...args)
    },
    ...options,
  })
}

export { supabase }
