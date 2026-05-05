import {
  expect,
  test,
  type BrowserContext,
  type Locator,
} from "@playwright/test";
import { dismissControllerFullscreenPrompt } from "./helpers/controller-fullscreen";
import { resolveControllerJoinUrl } from "./helpers/controller-join-url";
import { openArcadeHost } from "./helpers/open-arcade-host";

const PLATFORM_SETTINGS_STORAGE_KEY = "air-jam-platform-settings";
const TRACK_VOLUME_TOLERANCE = 0.01;

const seedPlatformSettings = {
  audio: {
    masterVolume: 0.5,
    musicVolume: 0.25,
    sfxVolume: 1,
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
  },
  feedback: {
    hapticsEnabled: true,
  },
};

const INITIAL_EFFECTIVE_MUSIC_VOLUME =
  seedPlatformSettings.audio.masterVolume * seedPlatformSettings.audio.musicVolume;

const installAudioProbe = async (
  context: BrowserContext,
  platformOrigin: string,
) => {
  await context.addInitScript(
    ({ platformOrigin, storageKey, settings }) => {
      if (window.location.origin === platformOrigin) {
        window.localStorage.setItem(storageKey, JSON.stringify(settings));
      }

      const OriginalAudio = window.Audio;
      const bucket: HTMLAudioElement[] = [];

      Object.defineProperty(window, "__airjamTestAudioElements", {
        configurable: true,
        value: bucket,
      });

      function InstrumentedAudio(
        this: unknown,
        src?: string,
      ): HTMLAudioElement {
        const element = new OriginalAudio(src);
        bucket.push(element);
        return element;
      }

      InstrumentedAudio.prototype = OriginalAudio.prototype;
      Object.defineProperty(InstrumentedAudio, "name", {
        configurable: true,
        value: "Audio",
      });

      // @ts-expect-error test-only browser shim
      window.Audio = InstrumentedAudio;
    },
    {
      platformOrigin,
      storageKey: PLATFORM_SETTINGS_STORAGE_KEY,
      settings: seedPlatformSettings,
    },
  );
};

const getControllerGameFrame = (page: Page) =>
  page.frameLocator('iframe[data-testid="arcade-controller-game-frame"]');

const maybeEnableBlockedAudio = async (
  hostGame: ReturnType<typeof getHostGameFrame>,
) => {
  const prompt = hostGame.getByTestId("air-capture-audio-blocked-prompt");
  if (await prompt.isVisible().catch(() => false)) {
    await hostGame.getByTestId("air-capture-enable-audio-button").click();
    await expect(prompt).toBeHidden();
  }
};

const readMusicTrackVolume = async (
  hostGame: ReturnType<typeof getHostGameFrame>,
) => {
  return hostGame.locator("body").evaluate(() => {
    const bucket = (
      window as typeof window & {
        __airjamTestAudioElements?: HTMLAudioElement[];
      }
    ).__airjamTestAudioElements;

    const musicTrack =
      bucket
        ?.filter((element) => element.src.includes("/music/track_"))
        .at(-1) ?? null;
    return musicTrack ? musicTrack.volume : null;
  });
};

const waitForTrackVolume = async (
  hostGame: ReturnType<typeof getHostGameFrame>,
  expectedVolume: number,
) => {
  await expect
    .poll(async () => {
      const currentVolume = await readMusicTrackVolume(hostGame);
      if (currentVolume === null) {
        return Number.POSITIVE_INFINITY;
      }

      return Math.abs(currentVolume - expectedVolume);
    }, {
      timeout: 20_000,
    })
    .toBeLessThanOrEqual(TRACK_VOLUME_TOLERANCE);

  const settledVolume = await readMusicTrackVolume(hostGame);
  if (settledVolume === null) {
    throw new Error("Music track volume disappeared before verification.");
  }

  return settledVolume;
};

const waitForMusicTrack = async (
  hostGame: ReturnType<typeof getHostGameFrame>,
) => {
  await expect
    .poll(async () => {
      const volume = await readMusicTrackVolume(hostGame);
      return volume !== null;
    })
    .toBe(true);
};

const readObservedTrackBaseVolume = async (
  hostGame: ReturnType<typeof getHostGameFrame>,
) => {
  await waitForMusicTrack(hostGame);

  const initialTrackVolume = await waitForSettledTrackVolume(hostGame);

  if (
    initialTrackVolume === null ||
    !Number.isFinite(initialTrackVolume) ||
    INITIAL_EFFECTIVE_MUSIC_VOLUME <= 0
  ) {
    throw new Error("Unable to derive the observed Air Capture track volume.");
  }

  return initialTrackVolume / INITIAL_EFFECTIVE_MUSIC_VOLUME;
};

const waitForSettledTrackVolume = async (
  hostGame: ReturnType<typeof getHostGameFrame>,
) => {
  let previousVolume: number | null = null;
  let stableReadCount = 0;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const currentVolume = await readMusicTrackVolume(hostGame);
    if (currentVolume !== null && Number.isFinite(currentVolume)) {
      if (
        previousVolume !== null &&
        Math.abs(currentVolume - previousVolume) <= 0.001
      ) {
        stableReadCount += 1;
        if (stableReadCount >= 2) {
          return currentVolume;
        }
      } else {
        stableReadCount = 0;
      }

      previousVolume = currentVolume;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return previousVolume;
};

const setSliderNearMax = async (locator: Locator) => {
  const track = locator.locator('[data-slot="slider-track"]');
  const trackBounds = await track.boundingBox();
  if (!trackBounds) {
    throw new Error("Slider track bounds were unavailable.");
  }
  const thumb = locator.locator('[data-slot="slider-thumb"]').first();
  const thumbBounds = await thumb.boundingBox();
  if (!thumbBounds) {
    throw new Error("Slider thumb bounds were unavailable.");
  }

  const page = locator.page();
  await page.mouse.move(
    thumbBounds.x + thumbBounds.width / 2,
    thumbBounds.y + thumbBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    trackBounds.x + trackBounds.width,
    trackBounds.y + trackBounds.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await thumb.focus();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await thumb.getAttribute("aria-valuenow");
    if (current && Number(current) >= 95) {
      break;
    }
    await thumb.press("ArrowRight");
  }

  await expect
    .poll(
      async () => {
        const current = await thumb.getAttribute("aria-valuenow");
        return current ? Number(current) : null;
      },
      {
        timeout: 5_000,
      },
    )
    .not.toBeNull();

  const finalValue = await thumb.getAttribute("aria-valuenow");
  if (!finalValue) {
    throw new Error("Slider thumb did not expose aria-valuenow.");
  }

  return Number(finalValue) / 100;
};

test("arcade local air-capture inherits initial settings and applies controller volume updates live", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  if (!baseURL) {
    throw new Error("Playwright baseURL was not configured.");
  }
  await installAudioProbe(context, baseURL);

  const hostPage = await context.newPage();
  const hostGame = await openArcadeHost({
    page: hostPage,
    baseURL,
    path: "/arcade/local-air-capture",
    readyTestId: "air-capture-host-lobby-overlay",
    readyTimeoutMs: 45_000,
  });

  const controllerJoinUrl = await resolveControllerJoinUrl({
    hostGame,
    baseURL,
  });

  await maybeEnableBlockedAudio(hostGame);
  const trackBaseVolume = await readObservedTrackBaseVolume(hostGame);
  const initialTrackVolume = await waitForTrackVolume(
    hostGame,
    trackBaseVolume * INITIAL_EFFECTIVE_MUSIC_VOLUME,
  );

  const controllerPage = await context.newPage();
  await controllerPage.goto(controllerJoinUrl);
  await dismissControllerFullscreenPrompt(controllerPage);

  const controllerGame = getControllerGameFrame(controllerPage);
  await expect(
    controllerGame.getByTestId("air-capture-controller-lobby-panel"),
  ).toBeVisible();

  await controllerPage.getByLabel("Open controller menu").click();
  await expect(
    controllerPage.getByTestId("platform-settings-panel"),
  ).toBeVisible();

  const updatedMusicVolume = await setSliderNearMax(
    controllerPage.getByTestId("platform-settings-music-volume"),
  );
  expect(updatedMusicVolume).toBeGreaterThan(0.25);
  const trackVolumeAfterMusicUpdate = await waitForTrackVolume(
    hostGame,
    trackBaseVolume * seedPlatformSettings.audio.masterVolume * updatedMusicVolume,
  );
  expect(trackVolumeAfterMusicUpdate).toBeGreaterThan(initialTrackVolume);

  const updatedMasterVolume = await setSliderNearMax(
    controllerPage.getByTestId("platform-settings-master-volume"),
  );
  expect(updatedMasterVolume).toBeGreaterThan(0.5);
  const finalTrackVolume = await waitForTrackVolume(
    hostGame,
    trackBaseVolume * updatedMasterVolume * updatedMusicVolume,
  );
  expect(finalTrackVolume).toBeGreaterThan(trackVolumeAfterMusicUpdate);
});
