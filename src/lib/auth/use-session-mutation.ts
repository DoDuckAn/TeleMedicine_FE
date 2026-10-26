"use client";

import {
  useMutation,
  type DefaultError,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  guardSessionMutationCallbacks,
  guardSessionMutationOptions,
} from "./session-mutation";
import { useAuthStore } from "./session-store";
import { assertCurrentLogin, isCurrentLogin } from "./session-ownership";

export function useSessionMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  queryClient?: QueryClient,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const loginId = useAuthStore((state) => state.loginId);
  const mutation = useMutation(
    { ...options, ...guardSessionMutationOptions(loginId, options) },
    queryClient,
  );
  const mutate: typeof mutation.mutate = (...args) => {
    if (!isCurrentLogin(loginId)) return;
    if (args[1]) args[1] = guardSessionMutationCallbacks(loginId, args[1]);
    mutation.mutate(...args);
  };
  const mutateAsync: typeof mutation.mutateAsync = async (...args) => {
    assertCurrentLogin(loginId);
    if (args[1]) args[1] = guardSessionMutationCallbacks(loginId, args[1]);
    const data = await mutation.mutateAsync(...args);
    assertCurrentLogin(loginId);
    return data;
  };
  return { ...mutation, mutate, mutateAsync };
}
