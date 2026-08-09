import type { ExplainStep } from '../../biology/explain'

export function ExplainBlock({ steps }: { steps: ExplainStep[] }) {
  return (
    <div className="space-y-1.5 rounded border border-(--color-accent-dim) bg-(--color-bg-canvas) px-3 py-2 font-mono text-xs">
      {steps.map((step, i) => (
        <div key={i}>
          <div className="text-(--color-text-muted)">{step.label}</div>
          <div className="whitespace-pre-wrap text-(--color-text-primary)">{step.value}</div>
        </div>
      ))}
    </div>
  )
}
