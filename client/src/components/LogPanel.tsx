import { useEffect, useRef } from 'react';
import type { LogEntry, PlayerId } from '@boloss/shared';

export default function LogPanel({ log, you }: { log: LogEntry[]; you: PlayerId | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log.length]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-white/10 bg-black/30">
      <div className="border-b border-white/10 px-3 py-1.5 font-display text-sm tracking-wide text-boloss-gold">Journal</div>
      <div ref={ref} className="thin-scroll flex-1 space-y-1 overflow-y-auto px-3 py-2 text-xs leading-snug">
        {log.slice(-40).map((e) => (
          <div
            key={e.id}
            className={
              e.player === undefined
                ? 'text-white/60'
                : e.player === you
                  ? 'text-emerald-300/90'
                  : 'text-red-300/90'
            }
          >
            {e.text}
          </div>
        ))}
        {log.length === 0 && <div className="text-white/40">La partie n'a pas encore commencé.</div>}
      </div>
    </div>
  );
}
