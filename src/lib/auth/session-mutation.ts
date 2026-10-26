import type {
  DefaultError,
  MutateOptions,
  MutationOptions,
} from "@tanstack/react-query";

import { assertCurrentLogin, isCurrentLogin } from "./session-ownership";

export function guardSessionMutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  loginId: string | null,
  options: MutationOptions<TData, TError, TVariables, TContext>,
): MutationOptions<TData, TError, TVariables, TContext> {
  const { mutationFn, onMutate, onSuccess, onError, onSettled } = options;
  return {
    ...options,
    mutationFn:
      mutationFn &&
      (async (...args) => {
        assertCurrentLogin(loginId);
        const data = await mutationFn(...args);
        assertCurrentLogin(loginId);
        return data;
      }),
    onMutate:
      onMutate &&
      ((...args) => {
        assertCurrentLogin(loginId);
        return onMutate(...args);
      }),
    // TanStack may invoke these after cache.clear(), even after unmount. Checking
    // only the HTTP response leaves a gap before each lifecycle callback.
    onSuccess:
      onSuccess &&
      ((...args) => {
        if (isCurrentLogin(loginId)) return onSuccess(...args);
      }),
    onError:
      onError &&
      ((...args) => {
        if (isCurrentLogin(loginId)) return onError(...args);
      }),
    onSettled:
      onSettled &&
      ((...args) => {
        if (isCurrentLogin(loginId)) return onSettled(...args);
      }),
  };
}

export function guardSessionMutationCallbacks<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  loginId: string | null,
  options: MutateOptions<TData, TError, TVariables, TContext>,
): MutateOptions<TData, TError, TVariables, TContext> {
  return {
    onSuccess:
      options.onSuccess &&
      ((...args) => {
        if (isCurrentLogin(loginId)) options.onSuccess?.(...args);
      }),
    onError:
      options.onError &&
      ((...args) => {
        if (isCurrentLogin(loginId)) options.onError?.(...args);
      }),
    onSettled:
      options.onSettled &&
      ((...args) => {
        if (isCurrentLogin(loginId)) options.onSettled?.(...args);
      }),
  };
}
