export const identity = (value) => value;

export const global_ = (name) => globalThis[name];

export const get = (target, key) => target[key];

export const index = (target, position) => target[position];

export const call = (target, method, args) => target[method](...args.toArray());

export const apply = (callee, args) => callee(...args.toArray());

export const construct = (class_, args) => new class_(...args.toArray());

export const object = (entries) => {
  const result = {};
  for (const [key, value] of entries.toArray()) result[key] = value;
  return result;
};

export const array = (items) => items.toArray();

export const nil = () => null;

export const nothing = () => undefined;

export const isNullish = (value) => value === undefined || value === null;

export const isUndefined = (value) => value === undefined;

export const attempt = (thunk) => {
  try {
    return { ok: true, value: thunk() };
  } catch (error) {
    return failure(error);
  }
};

export const attemptPromise = (promise) =>
  Promise.resolve(promise).then((value) => ({ ok: true, value }), failure);

const failure = (error) => ({
  ok: false,
  name: String(error?.name ?? "Error"),
  message: String(error?.message ?? error),
});

export const bigIntFromString = (digits) => BigInt(digits);

export const bigIntToString = (value) => value.toString();

export const jsonStringify = (value) => JSON.stringify(value);

export const jsonParse = (text) => JSON.parse(text);

export const cell = (value) => ({ value });

export const cellGet = (cell) => cell.value;

export const cellSet = (cell, value) => {
  cell.value = value;
};
