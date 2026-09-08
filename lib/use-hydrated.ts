"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `false` no servidor e no primeiro render do cliente, `true` depois da
 * hidratação. Útil para componentes que dependem de estado só-cliente
 * (carrinho persistido em localStorage) sem quebrar a hidratação.
 */
export function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
