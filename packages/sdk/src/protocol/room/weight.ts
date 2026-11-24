import { isPlainObject } from "./patch";

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
