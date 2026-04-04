import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { dismissControllerFullscreenPrompt } from "./helpers/controller-fullscreen";

const PLATFORM_SETTINGS_STORAGE_KEY = "air-jam-platform-settings";
const TRACK_BASE_VOLUME = 0.4;

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

const installAudioProbe = async (context: BrowserContext, platformOrigin: string) => {
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

const getHostGameFrame = (page: Page) =>
  page.frameLocator('iframe[data-testid="arcade-host-game-frame"]');

const getControllerGameFrame = (page: Page) =>
  page.frameLocator('iframe[data-testid="arcade-controller-game-frame"]');

const maybeEnableBlockedAudio = async (hostGame: ReturnType<typeof getHostGameFrame>) => {
  const prompt = hostGame.getByTestId("air-capture-audio-blocked-prompt");
  if (await prompt.isVisible().catch(() => false)) {
    await hostGame.getByTestId("air-capture-enable-audio-button").click();
    await expect(prompt).toBeHidden();
  }
};

const readMusicTrackVolume = async (hostGame: ReturnType<typeof getHostGameFrame>) => {
  return hostGame.locator("body").evaluate(() => {
    const bucket = (
      window as typeof window & {
        __airjamTestAudioElements?: HTMLAudioElement[];
      }
    ).__airjamTestAudioElements;

    const musicTrack =
      bucket?.filter((element) => element.src.includes("/music/track_")).at(-1) ??
      null;
    return musicTrack ? musicTrack.volume : null;
  });
};

const waitForTrackVolume = async (
  hostGame: ReturnType<typeof getHostGameFrame>,
  expectedVolume: number,
) => {
  await expect
    .poll(async () => readMusicTrackVolume(hostGame), {
      timeout: 20_000,
    })
    .toBeCloseTo(expectedVolume, 5);
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

const setSliderToMax = async (locator: Locator) => {
  const thumb = locator.locator('[data-slot="slider-thumb"]').first();
  await thumb.focus();
  await thumb.press("End");
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
  await hostPage.goto(`${baseURL}/arcade/local-air-capture`);

  const hostGame = getHostGameFrame(hostPage);
  await expect(
    hostGame.getByTestId("air-capture-host-lobby-overlay"),
  ).toBeVisible();
  await expect(hostGame.getByTestId("air-capture-room-code")).toHaveText(
    /[A-Z0-9]{4}/,
  );

  const roomCode = (
    await hostGame.getByTestId("air-capture-room-code").textContent()
  )?.trim();
  if (!roomCode) {
    throw new Error("Air Capture room code was not available.");
  }

  await maybeEnableBlockedAudio(hostGame);
  await waitForMusicTrack(hostGame);
  await waitForTrackVolume(hostGame, TRACK_BASE_VOLUME * 0.5 * 0.25);

  const controllerPage = await context.newPage();
  await controllerPage.goto(
    `${baseURL}/controller?room=${encodeURIComponent(roomCode)}`,
  );
  await dismissControllerFullscreenPrompt(controllerPage);

  const controllerGame = getControllerGameFrame(controllerPage);
  await expect(
    controllerGame.getByTestId("air-capture-controller-lobby-panel"),
  ).toBeVisible();

  await controllerPage.getByLabel("Open controller menu").click();
  await expect(controllerPage.getByTestId("platform-settings-panel")).toBeVisible();

  await setSliderToMax(controllerPage.getByTestId("platform-settings-music-volume"));
  await waitForTrackVolume(hostGame, TRACK_BASE_VOLUME * 0.5 * 1);

  await setSliderToMax(controllerPage.getByTestId("platform-settings-master-volume"));
  await waitForTrackVolume(hostGame, TRACK_BASE_VOLUME);
});
