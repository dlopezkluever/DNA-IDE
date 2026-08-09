export function ViewPlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-(--color-text-muted)">
      <span className="font-mono text-sm">{title}</span>
      <span className="text-xs">{note}</span>
    </div>
  )
}
