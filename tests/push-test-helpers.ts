import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function lockManager() {
  const tails = new Map<string, Promise<unknown>>();
  const names: string[] = [];
  return {
    names,
    request<T>(name: string, callback: () => Promise<T>) {
      names.push(name);
      const result = (tails.get(name) ?? Promise.resolve()).then(callback);
      tails.set(
        name,
        result.catch(() => {}),
      );
      return result;
    },
  };
}

// A transactional, asynchronous subset, not a map-shaped storage mock. Requests
// added in onsuccess keep transactions alive, and read/write transactions queue.
export function indexedDatabase() {
  const records = new Map<string, unknown>();
  let tail = Promise.resolve();
  let initialized = false;
  let failWrites = false;
  let writesUntilFailure: number | null = null;
  const checkWrite = () => {
    if (
      failWrites ||
      (writesUntilFailure !== null && writesUntilFailure-- === 0)
    ) {
      throw new Error("Storage unavailable");
    }
  };
  const indexedDB = {
    open() {
      const request = {} as IDBOpenDBRequest;
      const database = {
        close() {},
        createObjectStore() {},
        transaction(_name: string, mode: string) {
          const done = deferred<void>();
          const start = tail;
          tail = done.promise;
          let pending = 0;
          let finished = false;
          let started = false;
          let snapshot: Map<string, unknown>;
          const tx = {} as IDBTransaction;
          const finish = () =>
            setImmediate(() => {
              if (pending || finished || !started) return;
              finished = true;
              tx.oncomplete?.({} as Event);
              done.resolve();
            });
          const abort = () => {
            if (finished) return;
            finished = true;
            records.clear();
            snapshot.forEach((value, key) => records.set(key, value));
            tx.onabort?.({} as Event);
            done.resolve();
          };
          const operation = (run: () => unknown) => {
            const result = {} as IDBRequest;
            pending++;
            void start.then(() =>
              setImmediate(() => {
                if (finished) return;
                try {
                  Object.defineProperty(result, "result", { value: run() });
                  result.onsuccess?.({} as Event);
                } catch {
                  abort();
                } finally {
                  pending--;
                  finish();
                }
              }),
            );
            return result;
          };
          const store = {
            get: (key: string) =>
              operation(() => structuredClone(records.get(key))),
            put: (value: unknown, key: string) =>
              operation(() => {
                if (mode === "readwrite") checkWrite();
                records.set(key, structuredClone(value));
                return key;
              }),
            delete: (key: string) =>
              operation(() => {
                checkWrite();
                records.delete(key);
              }),
          };
          Object.assign(tx, { objectStore: () => store, abort });
          void start.then(() => {
            snapshot = new Map(records);
            started = true;
            finish();
          });
          return tx;
        },
      };
      setImmediate(() => {
        Object.defineProperty(request, "result", { value: database });
        if (!initialized) {
          initialized = true;
          request.onupgradeneeded?.({} as IDBVersionChangeEvent);
        }
        request.onsuccess?.({} as Event);
      });
      return request;
    },
  };
  return {
    records,
    indexedDB,
    failWrites: (value: boolean) => {
      failWrites = value;
    },
    failWriteAfter: (count: number) => {
      writesUntilFailure = count;
    },
  };
}

export function loadTypeScript<T>(
  filename: string,
  dependencies: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): T {
  const output = ts.transpileModule(
    fs.readFileSync(path.resolve(filename), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(
    output,
    {
      exports,
      require: (name: string) => {
        if (!(name in dependencies))
          throw new Error(`Unexpected dependency: ${name}`);
        return dependencies[name];
      },
      URL,
      AbortSignal,
      crypto: webcrypto,
      btoa,
      structuredClone,
      setTimeout,
      clearTimeout,
      ...globals,
    },
    { filename },
  );
  return exports as T;
}
