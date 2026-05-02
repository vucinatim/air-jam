import { useCallback, useEffect, useRef } from "react";
import { TEAM1_COLOR, TEAM2_COLOR } from "../../game/engine/constants";
import {
  createEmptySpriteMap,
  tintSprite,
  tintSpriteCanvas,
} from "../../game/engine/sprites";
import type {
  SpriteKey,
  SpriteTintCacheKey,
  SpriteVariant,
} from "../../game/engine/types";
import defendSprite from "/sprites/defend.png";
import endSprite from "/sprites/end.png";
import leftExtendedSprite from "/sprites/left-extended.png";
import leftShortSprite from "/sprites/left-short.png";
import rightExtendedSprite from "/sprites/right-extended.png";
import rightShortSprite from "/sprites/right-short.png";

const SPRITE_VARIANTS: { variant: SpriteVariant; url: string }[] = [
  { variant: "LeftShort", url: leftShortSprite },
  { variant: "RightShort", url: rightShortSprite },
  { variant: "LeftExtended", url: leftExtendedSprite },
  { variant: "RightExtended", url: rightExtendedSprite },
  { variant: "Defend", url: defendSprite },
  { variant: "End", url: endSprite },
];

const SPRITE_TEAMS: { team: "team1" | "team2"; color: string }[] = [
  { team: "team1", color: TEAM1_COLOR },
  { team: "team2", color: TEAM2_COLOR },
];

export const useCodeReviewSprites = () => {
  const spritesRef = useRef<Record<SpriteKey, HTMLCanvasElement | null>>(
    createEmptySpriteMap(),
  );
  const hitFlashSpriteCacheRef = useRef<
    Record<SpriteTintCacheKey, HTMLCanvasElement>
  >({});

  const getTintedOverlaySprite = useCallback(
    (
      spriteKey: SpriteKey,
      sprite: HTMLCanvasElement,
      color: string,
    ): HTMLCanvasElement => {
      const cacheKey = `${spriteKey}:${color}` as SpriteTintCacheKey;
      const cached = hitFlashSpriteCacheRef.current[cacheKey];
      if (cached) return cached;

      const tinted = tintSpriteCanvas(sprite, color);
      hitFlashSpriteCacheRef.current[cacheKey] = tinted;
      return tinted;
    },
    [],
  );

  useEffect(() => {
    for (const { team, color } of SPRITE_TEAMS) {
      for (const { variant, url } of SPRITE_VARIANTS) {
        const img = new Image();
        const key: SpriteKey = `${team}${variant}`;
        img.onload = () => {
          spritesRef.current[key] = tintSprite(img, color);
        };
        img.src = url;
      }
    }
  }, []);

  return {
    spritesRef,
    getTintedOverlaySprite,
  };
};
