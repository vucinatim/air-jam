/** Compares two secrets in time that depends only on their lengths. */
export const sameSecret = (given: string, expected: string): boolean => {
  let difference = given.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1)
    difference |=
      (given.charCodeAt(index % Math.max(given.length, 1)) || 0) ^
      expected.charCodeAt(index);
  return difference === 0;
};
