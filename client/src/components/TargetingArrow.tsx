import { useStore } from '../store';

/** A curved SVG arrow drawn from the selected source card to the cursor. */
export default function TargetingArrow() {
  const interaction = useStore((s) => s.interaction);
  const pointer = useStore((s) => s.pointer);

  // Pas de flèche tant qu'on n'a pas de cible à désigner : la confirmation
  // d'une carte sans cible n'en a pas besoin.
  if (interaction.mode === 'idle' || interaction.mode === 'confirm-play') return null;

  const selector =
    interaction.mode === 'play-target'
      ? `[data-hand="${interaction.handInstanceId}"]`
      : `[data-char="${interaction.attackerInstanceId}"]`;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const x1 = r.left + r.width / 2;
  const y1 = r.top + r.height / 2;
  const x2 = pointer.x;
  const y2 = pointer.y;

  // Control point for a gentle upward curve.
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - 60;

  const color = interaction.mode === 'attack' ? '#d1495b' : '#f2c14e';

  return (
    <svg className="pointer-events-none fixed inset-0 z-50 h-full w-full">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={color} />
        </marker>
      </defs>
      <path
        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray="2 10"
        markerEnd="url(#arrowhead)"
        opacity={0.9}
      />
      <circle cx={x1} cy={y1} r={7} fill={color} opacity={0.9} />
    </svg>
  );
}
