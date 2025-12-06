/**
 * Browser API type definitions for vendor-prefixed features
 * These extend standard DOM types to include vendor-specific APIs
 */

/**
 * Document interface extended with vendor-prefixed fullscreen APIs
 */
export interface DocumentWithFullscreen extends Document {
  /** Webkit fullscreen element */
  webkitFullscreenElement?: Element;
  /** Mozilla fullscreen element */
  mozFullScreenElement?: Element;
  /** Microsoft fullscreen element */
  msFullscreenElement?: Element;
  /** Webkit exit fullscreen method */
  webkitExitFullscreen?: () => Promise<void>;
  /** Mozilla exit fullscreen method */
  mozCancelFullScreen?: () => Promise<void>;
  /** Microsoft exit fullscreen method */
  msExitFullscreen?: () => Promise<void>;
}

/**
 * HTMLElement interface extended with vendor-prefixed fullscreen request APIs
 */
export interface ElementWithFullscreen extends HTMLElement {
  /** Webkit request fullscreen method */
  webkitRequestFullscreen?: () => Promise<void>;
  /** Mozilla request fullscreen method */
  mozRequestFullScreen?: () => Promise<void>;
  /** Microsoft request fullscreen method */
  msRequestFullscreen?: () => Promise<void>;
}

/**
 * Window interface extended with vendor-prefixed Audio Context
 */
export interface WindowWithAudio extends Window {
  /** Webkit AudioContext constructor */
  webkitAudioContext?: typeof AudioContext;
}
