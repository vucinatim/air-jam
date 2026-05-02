export const isRpcSerializable = (
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): boolean => {
  if (value === null || value === undefined) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return true;
  }

  if (valueType === "number") {
    return Number.isFinite(value);
  }

  if (
    valueType === "function" ||
    valueType === "symbol" ||
    valueType === "bigint"
  ) {
    return false;
  }

  if (valueType !== "object") {
    return false;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return false;
  }
  seen.add(objectValue);

  if (objectValue instanceof Date) {
    return true;
  }

  if (Array.isArray(objectValue)) {
    return objectValue.every((entry) => isRpcSerializable(entry, seen));
  }

  const prototype = Object.getPrototypeOf(objectValue);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  for (const entry of Object.values(objectValue as Record<string, unknown>)) {
    if (!isRpcSerializable(entry, seen)) {
      return false;
    }
  }

  return true;
};
