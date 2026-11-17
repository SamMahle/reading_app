import { useRef, useState, type PointerEvent } from 'react';
import { audio } from '@/audio/AudioService';
import type { Tile } from '@/engine/distractors';

export interface TileBoardProps {
  tiles: readonly Tile[];
  /** One box per grapheme; each holds a tile id or null. */
  placed: readonly (string | null)[];
  onPlace: (tileId: string, boxIdx: number) => void;
  onRemove: (boxIdx: number) => void;
  /** "Your turn" step: only this tile is live, and it is highlighted. */
  guideTileId?: string | null;
  disabled?: boolean;
}

const DRAG_THRESHOLD_PX = 10;

/**
 * Letter tiles plus sound boxes (spec §7). Tiles can be dragged into a box;
 * tapping a tile places it in the first empty box. A digraph is one tile.
 */
export function TileBoard({
  tiles,
  placed,
  onPlace,
  onRemove,
  guideTileId = null,
  disabled = false,
}: TileBoardProps) {
  const [drag, setDrag] = useState<{ tileId: string; dx: number; dy: number } | null>(null);
  const origin = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const tileById = new Map(tiles.map((tile) => [tile.id, tile]));
  const inTray = tiles.filter((tile) => !placed.includes(tile.id));
  const firstEmpty = placed.indexOf(null);

  const isLive = (tileId: string) => !disabled && (guideTileId === null || guideTileId === tileId);

  const onPointerDown = (tile: Tile) => (event: PointerEvent<HTMLButtonElement>) => {
    if (!isLive(tile.id)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX, y: event.clientY, moved: false };
    setDrag({ tileId: tile.id, dx: 0, dy: 0 });
    void audio.playSound(tile);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = origin.current;
    if (!start || !drag) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) start.moved = true;
    setDrag({ ...drag, dx, dy });
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = origin.current;
    const active = drag;
    origin.current = null;
    setDrag(null);
    if (!start || !active) return;
    if (!start.moved) {
      if (firstEmpty !== -1) onPlace(active.tileId, firstEmpty);
      return;
    }
    const target = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map((element) => element.closest<HTMLElement>('[data-box]'))
      .find((element) => element);
    const boxIdx = target ? Number(target.dataset.box) : Number.NaN;
    if (Number.isInteger(boxIdx)) onPlace(active.tileId, boxIdx);
  };

  return (
    <div className="tile-board" data-testid="tile-board">
      <div className="tile-board__boxes">
        {placed.map((tileId, boxIdx) => {
          const tile = tileId ? tileById.get(tileId) : undefined;
          return (
            <button
              key={boxIdx}
              type="button"
              className={`sound-box${tile ? ' sound-box--filled' : ''}`}
              data-box={boxIdx}
              data-testid="sound-box"
              aria-label={tile ? `Box ${boxIdx + 1}: ${tile.spelling}` : `Box ${boxIdx + 1}, empty`}
              onClick={() => {
                if (tile && !disabled && guideTileId === null) onRemove(boxIdx);
              }}
            >
              {tile?.spelling ?? ''}
            </button>
          );
        })}
      </div>
      <div className="tile-board__tray">
        {inTray.map((tile) => {
          const dragging = drag?.tileId === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              className={`tile${dragging ? ' tile--dragging' : ''}${guideTileId === tile.id ? ' tile--highlight' : ''}${guideTileId !== null && guideTileId !== tile.id ? ' tile--faded' : ''}`}
              style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
              data-testid="tile"
              data-spelling={tile.spelling}
              aria-disabled={!isLive(tile.id)}
              onPointerDown={onPointerDown(tile)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {tile.spelling}
            </button>
          );
        })}
      </div>
    </div>
  );
}
