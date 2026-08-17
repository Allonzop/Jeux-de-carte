import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import type { BoardCard } from '@boloss/shared';
import { useStore } from '../store';

/**
 * Zoom d'inspection des cartes.
 *
 * Le zoom ne doit JAMAIS surgir pendant qu'on joue. Il y a donc deux façons
 * volontaires de l'ouvrir, et aucune involontaire :
 *
 *  - **Clic droit** (ou clic sur une carte qui n'a pas d'action) : le zoom
 *    s'ouvre tout de suite et **reste affiché** jusqu'à ce qu'on le ferme.
 *  - **Souris parfaitement immobile** pendant {@link HOVER_DELAY} : le moindre
 *    déplacement du curseur relance le compteur, donc traverser le plateau
 *    n'ouvre plus rien.
 *  - **Appui long** au doigt, plus long qu'un tap ordinaire, et annulé dès que
 *    le doigt glisse (c'est alors un défilement).
 */

/** Souris : durée d'immobilité totale exigée. */
const HOVER_DELAY = 3000;
/**
 * Doigt : franchement plus long qu'un tap, sinon on avalerait le tap — un
 * appui « normal » sur mobile dure facilement 300 à 500 ms.
 */
const HOLD_DELAY = 700;
/** Déplacement au-delà duquel on considère que ça a bougé (px). */
const MOVE_TOLERANCE = 8;

export interface InspectHandlers {
  onPointerEnter: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerLeave: (e: PointerEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: () => void;
  onContextMenu: (e: MouseEvent) => void;
}

export function useInspectFactory() {
  const showInspect = useStore((s) => s.showInspect);
  const hideInspect = useStore((s) => s.hideInspect);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
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
      const arm = (e: PointerEvent, touch: boolean) => {
        if (!cardId) return;
        clear();
        // iOS n'émet pas toujours le `click` après un appui long : sans cette
        // remise à zéro, le drapeau resterait vrai et avalerait le tap suivant.
        longPressed.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(
          () => {
            timer.current = null;
            longPressed.current = touch;
            showInspect(cardId, board, touch);
          },
          touch ? HOLD_DELAY : HOVER_DELAY,
        );
      };

      const moved = (e: PointerEvent) => {
        const o = origin.current;
        if (!o) return true;
        return Math.abs(e.clientX - o.x) > MOVE_TOLERANCE || Math.abs(e.clientY - o.y) > MOVE_TOLERANCE;
      };

      return {
        onPointerEnter: (e) => {
          if (e.pointerType === 'mouse') arm(e, false);
        },
        // La souris doit rester immobile : tout déplacement relance le compteur.
        onPointerMove: (e) => {
          if (e.pointerType !== 'mouse') {
            // Au doigt, un glissement = défilement : on annule l'appui long.
            if (timer.current && moved(e)) clear();
            return;
          }
          if (!timer.current) {
            // Rien d'armé : soit le zoom est déjà ouvert, soit la carte vient
            // d'apparaître sous un curseur immobile — on (re)démarre.
            if (!useStore.getState().inspect) arm(e, false);
            return;
          }
          if (moved(e)) arm(e, false);
        },
        onPointerLeave: (e) => {
          if (e.pointerType !== 'mouse') return;
          clear();
          hideInspect();
        },
        onPointerDown: (e) => {
          if (e.pointerType !== 'mouse') arm(e, true);
        },
        onPointerUp: (e) => {
          if (e.pointerType === 'mouse') return;
          clear();
          // Un appui long a ouvert le zoom épinglé : on le laisse affiché.
          if (!longPressed.current) hideInspect();
        },
        onPointerCancel: () => {
          clear();
          hideInspect();
        },
        // Clic droit : ouverture immédiate et épinglée, au lieu du menu système.
        onContextMenu: (e) => {
          e.preventDefault();
          if (cardId) showInspect(cardId, board, true);
        },
      };
    },
    [clear, hideInspect, showInspect],
  );

  /** true si un appui long vient d'avoir lieu → le clic doit être ignoré. */
  const consumeLongPress = useCallback(() => {
    if (!longPressed.current) return false;
    longPressed.current = false;
    return true;
  }, []);

  /** Ouverture explicite (clic sur une carte sans action). */
  const pinInspect = useCallback(
    (cardId: string | undefined, board?: BoardCard) => {
      if (cardId) showInspect(cardId, board, true);
    },
    [showInspect],
  );

  return { inspectFor, consumeLongPress, pinInspect };
}

/** Variante pour une carte unique. */
export function useInspect(cardId: string | undefined, board?: BoardCard) {
  const { inspectFor, consumeLongPress, pinInspect } = useInspectFactory();
  return {
    handlers: inspectFor(cardId, board),
    consumeLongPress,
    pin: () => pinInspect(cardId, board),
  };
}
