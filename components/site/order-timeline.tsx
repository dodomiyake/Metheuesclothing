import type { TimelineStep } from '@/lib/orders/status';

/**
 * 13 Order Detail's vertical progress list (103:3631), reused by
 * /track-order, which drew it first.
 *
 * Three states, three shapes AND three weights — done is a small filled
 * dot, current is a larger Forest one with a SemiBold label and a "Current
 * step" meta line, todo is an outline. Never colour alone (rule 8), which
 * is why the current step says so in words.
 */
export function OrderTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {steps.map((step) => (
        <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              marginTop: 5,
              width: step.state === 'current' ? 14 : step.state === 'done' ? 10 : 12,
              height: step.state === 'current' ? 14 : step.state === 'done' ? 10 : 12,
              borderRadius: '50%',
              background:
                step.state === 'current'
                  ? 'var(--mc-status-success)'
                  : step.state === 'done'
                    ? 'var(--mc-text-primary)'
                    : 'transparent',
              border: step.state === 'todo' ? '1px solid var(--mc-border-default)' : 'none',
            }}
          />
          <div>
            <p
              style={{
                fontSize: 15,
                fontWeight: step.state === 'current' ? 600 : 500,
                color: step.state === 'todo' ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
                margin: 0,
              }}
            >
              {step.label}
            </p>
            {(step.detail || step.state === 'current') && (
              <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: '3px 0 0' }}>
                {step.state === 'current' ? 'Current step' : step.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
