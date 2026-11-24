/**
 * A channel's state travels as patches against a revision. A patch names the
 * keys that changed, descending only through plain objects; arrays and other
 * values are replaced whole. Unlike JSON Merge Patch it can set a value to
 * `null`, which stores do constantly.
 */
export type StateDocument = Record<string, unknown>;
export type StatePath = readonly string[];

export interface StatePatch {
  readonly set: ReadonlyArray<readonly [StatePath, unknown]>;
  readonly unset: readonly StatePath[];
}

export const isPlainObject = (value: unknown): value is StateDocument => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const ownValue = (object: StateDocument, key: string): unknown =>
  Object.hasOwn(object, key) ? object[key] : undefined;

/** The value at `path`, or undefined when the path does not lead to one. */
export const readStatePath = (
  document: StateDocument,
  path: StatePath,
): unknown => {
  let current: unknown = document;
  for (const key of path) {
    if (!isPlainObject(current)) return undefined;
    current = ownValue(current, key);
  }
  return current;
};

/**
 * The patch that turns `previous` into `next`. Stores update immutably, so an
 * unchanged branch is skipped by identity without being walked. A key whose
 * value is `undefined` counts as absent, as it does in JSON.
 */
export const diffState = (
  previous: StateDocument,
  next: StateDocument,
): StatePatch => {
  const set: Array<readonly [StatePath, unknown]> = [];
  const unset: StatePath[] = [];
  const walk = (
    before: StateDocument,
    after: StateDocument,
    path: string[],
  ) => {
    for (const key of Object.keys(before))
      if (before[key] !== undefined && ownValue(after, key) === undefined)
        unset.push([...path, key]);
    for (const key of Object.keys(after)) {
      const value = after[key];
      if (value === undefined) continue;
      const old = ownValue(before, key);
      if (old === value) continue;
      if (isPlainObject(old) && isPlainObject(value))
        walk(old, value, [...path, key]);
      else set.push([[...path, key], value]);
    }
  };
  walk(previous, next, []);
  return { set, unset };
};

export const isEmptyStatePatch = (patch: StatePatch): boolean =>
  patch.set.length === 0 && patch.unset.length === 0;

// Assigning a key named "__proto__" would change the prototype instead of
// adding an entry, so entries are defined rather than assigned.
const withEntry = (
  object: StateDocument,
  key: string,
  value: unknown,
): StateDocument => {
  const copy = { ...object };
  Object.defineProperty(copy, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return copy;
};

const withoutEntry = (object: StateDocument, key: string): StateDocument => {
  const copy = { ...object };
  delete copy[key];
  return copy;
};

const update = (
  document: StateDocument,
  path: StatePath,
  change: (parent: StateDocument, key: string) => StateDocument | null,
): StateDocument | null => {
  const [key, ...rest] = path;
  if (key === undefined) return null;
  if (rest.length === 0) return change(document, key);
  const child = ownValue(document, key);
  if (!isPlainObject(child)) return null;
  const updated = update(child, rest, change);
  return updated && withEntry(document, key, updated);
};

/**
 * Applies removals, then assignments, without touching `document`. Returns
 * null when the patch does not fit: a path runs through something that is not
 * a plain object, or removes a key that is not there. A receiver that gets
 * null has diverged and needs the full document.
 */
export const applyStatePatch = (
  document: StateDocument,
  patch: StatePatch,
): StateDocument | null => {
  let current = document;
  for (const path of patch.unset) {
    const next = update(current, path, (parent, key) =>
      Object.hasOwn(parent, key) ? withoutEntry(parent, key) : null,
    );
    if (!next) return null;
    current = next;
  }
  for (const [path, value] of patch.set) {
    const next = update(current, path, (parent, key) =>
      withEntry(parent, key, value),
    );
    if (!next) return null;
    current = next;
  }
  return current;
};
