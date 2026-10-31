<!-- Generated from content/docs/sdk/assets-and-theme/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/sdk/assets-and-theme -->

# Game Assets and Theme

Declare a game's sounds, images, other loaded files, colours and fonts in its
React-free game declaration. Tools read them through `airjam.inspect_game` in
`declaration.assets` and `declaration.theme`.

## Declare loaded files

Keep the assets in a leaf module so rendering and audio code can import them
without importing the config back again.

```ts filename="src/game/assets.ts"
import { defineAirJamAssets } from "@air-jam/sdk/core";

export const gameAssets = defineAirJamAssets({
  sounds: {
    hit: { src: ["/sounds/hit.wav"], volume: 0.55 },
    music: {
      src: ["/music/theme.mp3"],
      category: "music",
      html5: true,
      surface: "host",
    },
  },
  images: { player: { src: "/images/player.png" } },
  files: { animation: { src: "/animations/fire.json" } },
});
```

Pass it as `defineAirJamGame({ assets: gameAssets, ... })`. Every source is a
served path under the game's `public/` directory: it starts with `/` and has no
parent segments, query or hash. A sound takes a nonempty `src` array and optional
`volume` (0 to 1), `loop`, `html5`, `sprite` and `category` (`music` or `sfx`).
A sprite maps its name to `[offsetMilliseconds, durationMilliseconds]`.
`surface` selects `host` or `controller`; omitting it makes the sound available
on both. Images and files each take `{ src }`.

The React binding mounts audio for each surface automatically. Remove your
own `<AudioRuntime>` wrappers. Existing `useAudio` calls and `MusicPlaylist`
components use the binding's runtime. Host-only music never loads on a phone.
Read image and file paths from the object, for example
`gameAssets.images.player.src`, rather than repeating URL strings.

Inspection checks every declared source exists and fails with
`AJ_ASSET_MISSING`, naming the game, entry and missing path. This checks file
presence, not whether code loads an undeclared URL. Arcade cover, thumbnail and
preview media remain outside this declaration.

## Declare colours and fonts

```ts filename="src/game/theme.ts"
import { defineAirJamTheme } from "@air-jam/sdk/core";

export const gameTheme = defineAirJamTheme({
  colors: { background: "#050816", team1: "#f97316", team2: "#38bdf8" },
  fonts: { display: '"Avenir Next", "Trebuchet MS", sans-serif' },
});
```

Pass it as `defineAirJamGame({ theme: gameTheme, ... })`. Keys are lower camel
case. Colours use hex, `rgb()`, `rgba()`, `hsl()` or `oklch()`; fonts are CSS
font-family lists. Font files still load through your existing CSS imports or
declared file paths.

The binding renders a `<style>` with each surface on its first render. It
exposes `--airjam-color-background`, `--airjam-color-team1` and
`--airjam-font-display`; camel case keys become kebab case. No generation step
or effect is needed. Map the variables to existing Tailwind names:

```css filename="src/index.css"
@import "tailwindcss";

@theme inline {
  --color-game-bg: var(--airjam-color-background);
  --color-game-orange: var(--airjam-color-team1);
  --font-game: var(--airjam-font-display);
}
```

Existing classes such as `bg-game-bg` keep their names. Canvas and 3D code read
`gameTheme.colors.team1` and `gameTheme.fonts.display` directly. Remove the
literals they replace. Shadows, gradients and layout remain handwritten CSS.

Both fields are optional; an omitted field is described as empty maps.
The declaration graph must remain free of React, the DOM and CSS imports.
