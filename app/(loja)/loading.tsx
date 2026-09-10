/**
 * Fallback de navegação da loja. Aparece na hora em que o cliente clica —
 * feedback imediato enquanto a próxima página carrega, sem tela "travada".
 */
export default function LojaLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-40 rounded-lg bg-black/[0.06]" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-black/[0.06]" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-square rounded-2xl bg-black/[0.06]" />
            <div className="h-4 w-3/4 rounded bg-black/[0.06]" />
            <div className="h-4 w-1/3 rounded bg-black/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}
