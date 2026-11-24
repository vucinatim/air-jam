import {
  applyStatePatch,
  isPlainObject,
  readStatePath,
  type StateDocument,
  type StatePatch,
  type StatePath,
} from "./patch";

/** UTF-8 length without encoding, so a room can measure frames for free. */
export const utf8ByteLength = (text: string): number => {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
};

const jsonBytes = (value: unknown): number =>
  utf8ByteLength(JSON.stringify(value) ?? "");

/**
 * What a state document weighs against `stateBytes`: the JSON bytes of every
 * key and of every value that is not a plain object, leaving out braces,
 * colons and commas. Without the punctuation a key's weight does not depend on
 * its neighbours, so a patch changes the weight by exactly the difference of
 * the entries it replaces.
 */
export const stateWeight = (value: unknown): number => {
  if (!isPlainObject(value)) return jsonBytes(value);
  let weight = 0;
  for (const [key, child] of Object.entries(value))
    if (child !== undefined) weight += stateEntryWeight(key, child);
  return weight;
};

/** What one key and its value add to the weight of the object holding them. */
export const stateEntryWeight = (key: string, value: unknown): number =>
  jsonBytes(key) + stateWeight(value);

/**
 * Applies a patch one operation at a time, so the document's weight changes
 * by exactly what each operation replaces. Returns null when the patch does
 * not fit, as `applyStatePatch` does.
 */
export const applyWeighedStatePatch = (
  document: StateDocument,
  weight: number,
  patch: StatePatch,
): { document: StateDocument; weight: number } | null => {
  const entryWeight = (path: StatePath, value: unknown) =>
    value === undefined ? 0 : stateEntryWeight(path.at(-1) ?? "", value);
  let current = document;
  let currentWeight = weight;
  for (const path of patch.unset) {
    const previous = readStatePath(current, path);
    const next = applyStatePatch(current, { set: [], unset: [path] });
    if (!next) return null;
    currentWeight -= entryWeight(path, previous);
    current = next;
  }
  for (const [path, value] of patch.set) {
    const previous = readStatePath(current, path);
    const next = applyStatePatch(current, { set: [[path, value]], unset: [] });
    if (!next) return null;
    currentWeight += entryWeight(path, value) - entryWeight(path, previous);
    current = next;
  }
  return { document: current, weight: currentWeight };
};
