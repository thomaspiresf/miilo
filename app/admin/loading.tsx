export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-40 rounded-lg bg-black/[0.06]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-black/[0.05]" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-black/[0.05]" />
      <div className="h-64 rounded-2xl bg-black/[0.05]" />
    </div>
  );
}
