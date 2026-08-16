import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import type { BoardCard } from '@boloss/shared';
import { useStore } from '../store';

const HOVER_DELAY = 500; // survol souris (desktop)
const HOLD_DELAY = 400; // appui long (mobile)

export interface InspectHandlers {
  onPointerEnter: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerLeave: (e: PointerEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: () => void;
  onContextMenu: (e: MouseEvent) => void;
}

/**
 * Zoom d'inspection façon Hearthstone, version « fabrique » : un seul hook pour
 * une liste de cartes (grille du deck builder par exemple).
 *
 *  - Souris : survol maintenu ~0,5 s → la carte s'affiche en grand.
 *  - Tactile : appui long ~0,4 s → même affichage, et le clic qui suit est
 *    annulé (sinon lâcher le doigt jouerait la carte par accident).
 */
export function useInspectFactory() {
  const showInspect = useStore((s) => s.showInspect);
  const hideInspect = useStore((s) => s.hideInspect);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Nettoyage si le composant disparaît pendant un appui.
  useEffect(() => clear, [clear]);

  const inspectFor = useCallback(
    (cardId: string | undefined, board?: BoardCard): InspectHandlers => {
      const start = (touch: boolean) => {
        if (!cardId) return;
        clear();
        timer.current = setTimeout(
          () => {
            longPressed.current = touch;
            showInspect(cardId, board);
          },
          touch ? HOLD_DELAY : HOVER_DELAY,
        );
      };
      const stop = () => {
        clear();
        hideInspect();
      };
      return {
        onPointerEnter: (e) => {
          if (e.pointerType === 'mouse') start(false);
        },
        // Filet de sécurité : si la carte apparaît sous un curseur immobile
        // (re-render après un mulligan, décalage de mise en page…), aucun
        // `pointerenter` n'est émis. Le moindre mouvement relance donc le délai.
        onPointerMove: (e) => {
          if (e.pointerType === 'mouse' && !timer.current) start(false);
        },
        onPointerLeave: (e) => {
          if (e.pointerType === 'mouse') stop();
        },
        onPointerDown: (e) => {
          if (e.pointerType !== 'mouse') start(true);
        },
        onPointerUp: (e) => {
          if (e.pointerType !== 'mouse') stop();
        },
        onPointerCancel: stop,
        // Empêche le menu contextuel iOS/Android pendant l'appui long.
        onContextMenu: (e) => e.preventDefault(),
      };
    },
    [clear, hideInspect, showInspect],
  );

  /** true si un appui long vient d'avoir lieu → le clic doit être ignoré. */
  const consumeLongPress = useCallback(() => {
    if (!longPressed.current) return false;
    longPressed.current = false;
    hideInspect();
    return true;
  }, [hideInspect]);

  return { inspectFor, consumeLongPress };
}

/** Variante pour une carte unique. */
export function useInspect(cardId: string | undefined, board?: BoardCard) {
  const { inspectFor, consumeLongPress } = useInspectFactory();
  return { handlers: inspectFor(cardId, board), consumeLongPress };
}
