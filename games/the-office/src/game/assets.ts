import { defineAirJamAssets } from "@air-jam/sdk/core";

export const theOfficeAssets = defineAirJamAssets({
  sounds: {
    "task-start": {
      src: ["/sounds/task-start.mp3"],
      volume: 0.7,
      surface: "host",
    },
    "task-complete": {
      src: ["/sounds/task-complete.mp3"],
      volume: 0.7,
      surface: "host",
    },
    "new-order": {
      src: ["/sounds/new-order.mp3"],
      volume: 0.7,
      surface: "host",
    },
    "game-over": {
      src: ["/sounds/game-over.mp3"],
      volume: 0.7,
      surface: "host",
    },
    "order-timeout": {
      src: ["/sounds/order-timeout.mp3"],
      volume: 0.7,
      surface: "host",
    },
  },
  images: {
    spela: {
      src: "/team/spela.webp",
    },
    ziga: {
      src: "/team/ziga.webp",
    },
    miha: {
      src: "/team/miha.webp",
    },
    matej: {
      src: "/team/matej.webp",
    },
    niki: {
      src: "/team/niki.webp",
    },
    vane: {
      src: "/team/vane.webp",
    },
    domen: {
      src: "/team/domen.webp",
    },
    timk: {
      src: "/team/timk.webp",
    },
    timv: {
      src: "/team/timv.webp",
    },
    codingTable1: {
      src: "/items/coding-table-1.png",
    },
    codingTable2: {
      src: "/items/coding-table-2.png",
    },
    tablePrinter: {
      src: "/items/table-printer.png",
    },
    meetingTable: {
      src: "/items/meeting-table.png",
    },
    server: {
      src: "/items/server.png",
    },
    door: {
      src: "/items/door.png",
    },
    couch1: {
      src: "/items/couch-1.png",
    },
    couch2: {
      src: "/items/couch-2.png",
    },
    beanbag: {
      src: "/items/beanbag.png",
    },
    kitchen: {
      src: "/items/kitchen.png",
    },
    fifa: {
      src: "/items/fifa.png",
    },
    kitchenTable: {
      src: "/items/kitchen-table.png",
    },
  },
  files: {},
});
export type OfficeSoundId = keyof typeof theOfficeAssets.sounds;
