globalThis._importMeta_=globalThis._importMeta_||{url:"file:///_entry.js",env:process.env};import 'node-fetch-native/polyfill';
import { Server as Server$1 } from 'http';
import { Server } from 'https';
import destr from 'destr';
import { defineEventHandler, handleCacheHeaders, createEvent, eventHandler, createError, createApp, createRouter, lazyEventHandler } from 'h3';
import { createFetch as createFetch$1, Headers } from 'ohmyfetch';
import { createRouter as createRouter$1 } from 'radix3';
import { createCall, createFetch } from 'unenv/runtime/fetch/index';
import { createHooks } from 'hookable';
import { snakeCase } from 'scule';
import { hash } from 'ohash';
import { parseURL, withQuery, withLeadingSlash, withoutTrailingSlash } from 'ufo';
import { createStorage } from 'unstorage';
import { promises } from 'fs';
import { dirname, resolve } from 'pathe';
import { fileURLToPath } from 'url';

const _runtimeConfig = {"app":{"baseURL":"/","buildAssetsDir":"/_nuxt/","cdnURL":""},"nitro":{"routes":{},"envPrefix":"NUXT_"},"public":{}};
const ENV_PREFIX = "NITRO_";
const ENV_PREFIX_ALT = _runtimeConfig.nitro.envPrefix ?? process.env.NITRO_ENV_PREFIX ?? "_";
const getEnv = (key) => {
  const envKey = snakeCase(key).toUpperCase();
  return destr(process.env[ENV_PREFIX + envKey] ?? process.env[ENV_PREFIX_ALT + envKey]);
};
function isObject(input) {
  return typeof input === "object" && !Array.isArray(input);
}
function overrideConfig(obj, parentKey = "") {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey);
    if (isObject(obj[key])) {
      if (isObject(envValue)) {
        obj[key] = { ...obj[key], ...envValue };
      }
      overrideConfig(obj[key], subKey);
    } else {
      obj[key] = envValue ?? obj[key];
    }
  }
}
overrideConfig(_runtimeConfig);
const config = deepFreeze(_runtimeConfig);
const useRuntimeConfig = () => config;
function deepFreeze(object) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }
  return Object.freeze(object);
}

const globalTiming = globalThis.__timing__ || {
  start: () => 0,
  end: () => 0,
  metrics: []
};
function timingMiddleware(_req, res, next) {
  const start = globalTiming.start();
  const _end = res.end;
  res.end = (data, encoding, callback) => {
    const metrics = [["Generate", globalTiming.end(start)], ...globalTiming.metrics];
    const serverTiming = metrics.map((m) => `-;dur=${m[1]};desc="${encodeURIComponent(m[0])}"`).join(", ");
    if (!res.headersSent) {
      res.setHeader("Server-Timing", serverTiming);
    }
    _end.call(res, data, encoding, callback);
  };
  next();
}

const _assets = {

};

function normalizeKey(key) {
  if (!key) {
    return "";
  }
  return key.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "");
}

const assets$1 = {
  getKeys() {
    return Promise.resolve(Object.keys(_assets))
  },
  hasItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(id in _assets)
  },
  getItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].import() : null)
  },
  getMeta (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].meta : {})
  }
};

const storage = createStorage({});

const useStorage = () => storage;

storage.mount('/assets', assets$1);

const defaultCacheOptions = {
  name: "_",
  base: "/cache",
  swr: true,
  maxAge: 1
};
function defineCachedFunction(fn, opts) {
  opts = { ...defaultCacheOptions, ...opts };
  const pending = {};
  const group = opts.group || "nitro";
  const name = opts.name || fn.name || "_";
  const integrity = hash([opts.integrity, fn, opts]);
  async function get(key, resolver) {
    const cacheKey = [opts.base, group, name, key + ".json"].filter(Boolean).join(":").replace(/:\/$/, ":index");
    const entry = await useStorage().getItem(cacheKey) || {};
    const ttl = (opts.maxAge ?? opts.maxAge ?? 0) * 1e3;
    if (ttl) {
      entry.expires = Date.now() + ttl;
    }
    const expired = entry.integrity !== integrity || ttl && Date.now() - (entry.mtime || 0) > ttl;
    const _resolve = async () => {
      if (!pending[key]) {
        entry.value = void 0;
        entry.integrity = void 0;
        entry.mtime = void 0;
        entry.expires = void 0;
        pending[key] = Promise.resolve(resolver());
      }
      entry.value = await pending[key];
      entry.mtime = Date.now();
      entry.integrity = integrity;
      delete pending[key];
      useStorage().setItem(cacheKey, entry).catch((error) => console.error("[nitro] [cache]", error));
    };
    const _resolvePromise = expired ? _resolve() : Promise.resolve();
    if (opts.swr && entry.value) {
      _resolvePromise.catch(console.error);
      return Promise.resolve(entry);
    }
    return _resolvePromise.then(() => entry);
  }
  return async (...args) => {
    const key = (opts.getKey || getKey)(...args);
    const entry = await get(key, () => fn(...args));
    let value = entry.value;
    if (opts.transform) {
      value = await opts.transform(entry, ...args) || value;
    }
    return value;
  };
}
const cachedFunction = defineCachedFunction;
function getKey(...args) {
  return args.length ? hash(args, {}) : "";
}
function defineCachedEventHandler(handler, opts = defaultCacheOptions) {
  const _opts = {
    ...opts,
    getKey: (event) => {
      return decodeURI(parseURL(event.req.originalUrl || event.req.url).pathname).replace(/\/$/, "/index");
    },
    group: opts.group || "nitro/handlers",
    integrity: [
      opts.integrity,
      handler
    ]
  };
  const _cachedHandler = cachedFunction(async (incomingEvent) => {
    const reqProxy = cloneWithProxy(incomingEvent.req, { headers: {} });
    const resHeaders = {};
    const resProxy = cloneWithProxy(incomingEvent.res, {
      statusCode: 200,
      getHeader(name) {
        return resHeaders[name];
      },
      setHeader(name, value) {
        resHeaders[name] = value;
        return this;
      },
      getHeaderNames() {
        return Object.keys(resHeaders);
      },
      hasHeader(name) {
        return name in resHeaders;
      },
      removeHeader(name) {
        delete resHeaders[name];
      },
      getHeaders() {
        return resHeaders;
      }
    });
    const event = createEvent(reqProxy, resProxy);
    event.context = incomingEvent.context;
    const body = await handler(event);
    const headers = event.res.getHeaders();
    headers.Etag = `W/"${hash(body)}"`;
    headers["Last-Modified"] = new Date().toUTCString();
    const cacheControl = [];
    if (opts.swr) {
      if (opts.maxAge) {
        cacheControl.push(`s-maxage=${opts.maxAge}`);
      }
      if (opts.staleMaxAge) {
        cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`);
      } else {
        cacheControl.push("stale-while-revalidate");
      }
    } else if (opts.maxAge) {
      cacheControl.push(`max-age=${opts.maxAge}`);
    }
    if (cacheControl.length) {
      headers["Cache-Control"] = cacheControl.join(", ");
    }
    const cacheEntry = {
      code: event.res.statusCode,
      headers,
      body
    };
    return cacheEntry;
  }, _opts);
  return defineEventHandler(async (event) => {
    const response = await _cachedHandler(event);
    if (event.res.headersSent || event.res.writableEnded) {
      return response.body;
    }
    if (handleCacheHeaders(event, {
      modifiedTime: new Date(response.headers["Last-Modified"]),
      etag: response.headers.etag,
      maxAge: opts.maxAge
    })) {
      return;
    }
    event.res.statusCode = response.code;
    for (const name in response.headers) {
      event.res.setHeader(name, response.headers[name]);
    }
    return response.body;
  });
}
function cloneWithProxy(obj, overrides) {
  return new Proxy(obj, {
    get(target, property, receiver) {
      if (property in overrides) {
        return overrides[property];
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property in overrides) {
        overrides[property] = value;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    }
  });
}
const cachedEventHandler = defineCachedEventHandler;

const plugins = [
  
];

function hasReqHeader(req, header, includes) {
  const value = req.headers[header];
  return value && typeof value === "string" && value.toLowerCase().includes(includes);
}
function isJsonRequest(event) {
  return hasReqHeader(event.req, "accept", "application/json") || hasReqHeader(event.req, "user-agent", "curl/") || hasReqHeader(event.req, "user-agent", "httpie/") || event.req.url?.endsWith(".json") || event.req.url?.includes("/api/");
}
function normalizeError(error) {
  const cwd = process.cwd();
  const stack = (error.stack || "").split("\n").splice(1).filter((line) => line.includes("at ")).map((line) => {
    const text = line.replace(cwd + "/", "./").replace("webpack:/", "").replace("file://", "").trim();
    return {
      text,
      internal: line.includes("node_modules") && !line.includes(".cache") || line.includes("internal") || line.includes("new Promise")
    };
  });
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage ?? (statusCode === 404 ? "Route Not Found" : "Internal Server Error");
  const message = error.message || error.toString();
  return {
    stack,
    statusCode,
    statusMessage,
    message
  };
}

const errorHandler = (async function errorhandler(_error, event) {
  const { stack, statusCode, statusMessage, message } = normalizeError(_error);
  const errorObject = {
    url: event.req.url,
    statusCode,
    statusMessage,
    message,
    description: "",
    data: _error.data
  };
  event.res.statusCode = errorObject.statusCode;
  event.res.statusMessage = errorObject.statusMessage;
  if (errorObject.statusCode !== 404) {
    console.error("[nuxt] [request error]", errorObject.message + "\n" + stack.map((l) => "  " + l.text).join("  \n"));
  }
  if (isJsonRequest(event)) {
    event.res.setHeader("Content-Type", "application/json");
    event.res.end(JSON.stringify(errorObject));
    return;
  }
  const url = withQuery("/__nuxt_error", errorObject);
  const html = await $fetch(url).catch((error) => {
    console.error("[nitro] Error while generating error response", error);
    return errorObject.statusMessage;
  });
  event.res.setHeader("Content-Type", "text/html;charset=UTF-8");
  event.res.end(html);
});

const assets = {
  "/favicon.ico": {
    "type": "image/vnd.microsoft.icon",
    "etag": "\"ec6-N0puIDeltYaFU6kQPUhpdQ1ILjY\"",
    "mtime": "2022-07-11T06:13:34.000Z",
    "path": "../public/favicon.ico"
  },
  "/index.html": {
    "type": "text/html; charset=utf-8",
    "etag": "\"164-O3wjJrICDgl/A8gfxN4VhAcBf2k\"",
    "mtime": "2022-10-17T11:04:06.336Z",
    "path": "../public/index.html"
  },
  "/200/index.html": {
    "type": "text/html; charset=utf-8",
    "etag": "\"164-O3wjJrICDgl/A8gfxN4VhAcBf2k\"",
    "mtime": "2022-10-17T11:04:06.338Z",
    "path": "../public/200/index.html"
  },
  "/404/index.html": {
    "type": "text/html; charset=utf-8",
    "etag": "\"164-O3wjJrICDgl/A8gfxN4VhAcBf2k\"",
    "mtime": "2022-10-17T11:04:06.338Z",
    "path": "../public/404/index.html"
  },
  "/images/algolia.png": {
    "type": "image/png",
    "etag": "\"26da-AZQ1d77a9As9g/ipSRLkpfGiDf0\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/algolia.png"
  },
  "/images/logo-icon.png": {
    "type": "image/png",
    "etag": "\"402-A4RAa4r8/3Gq6yClLAL+K6U5pOc\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/logo-icon.png"
  },
  "/images/sidebar-buynow-bg.svg": {
    "type": "image/svg+xml",
    "etag": "\"6907-WEobvLeSUI1MCWppxaNjEJqRJOY\"",
    "mtime": "2022-07-14T09:40:42.000Z",
    "path": "../public/images/sidebar-buynow-bg.svg"
  },
  "/_nuxt/about-2e91e021.mjs": {
    "type": "application/javascript",
    "etag": "\"19f-070TGqv3tGO7cnB93Csgxdukcdg\"",
    "mtime": "2022-10-17T11:03:54.844Z",
    "path": "../public/_nuxt/about-2e91e021.mjs"
  },
  "/_nuxt/alerts-458c04d2.mjs": {
    "type": "application/javascript",
    "etag": "\"b57-Rsd3Tm+GSqd4X0Yha3SvXGbFvDg\"",
    "mtime": "2022-10-17T11:03:54.844Z",
    "path": "../public/_nuxt/alerts-458c04d2.mjs"
  },
  "/_nuxt/BaseCard-de331639.mjs": {
    "type": "application/javascript",
    "etag": "\"294-KE2+Uc48+HD7gAA0rm4yNoAVWb4\"",
    "mtime": "2022-10-17T11:03:54.844Z",
    "path": "../public/_nuxt/BaseCard-de331639.mjs"
  },
  "/_nuxt/blank-015ae3e5.mjs": {
    "type": "application/javascript",
    "etag": "\"1b5-OmgHTVlH+oy6rLJonqJ8XeRw35Y\"",
    "mtime": "2022-10-17T11:03:54.845Z",
    "path": "../public/_nuxt/blank-015ae3e5.mjs"
  },
  "/_nuxt/buttons-94d2fa48.mjs": {
    "type": "application/javascript",
    "etag": "\"1312-rN4zGsOypooFQ6Ef9UEmqF1UvhM\"",
    "mtime": "2022-10-17T11:03:54.844Z",
    "path": "../public/_nuxt/buttons-94d2fa48.mjs"
  },
  "/_nuxt/cards-3f8a43b9.mjs": {
    "type": "application/javascript",
    "etag": "\"2083-7W6qcXkkU7JfpgLBrazsR20C2mo\"",
    "mtime": "2022-10-17T11:03:54.844Z",
    "path": "../public/_nuxt/cards-3f8a43b9.mjs"
  },
  "/_nuxt/carousel-fc5da880.mjs": {
    "type": "application/javascript",
    "etag": "\"3a1-Wyr9hudJrG4Vj7CxWuKN6yybOA4\"",
    "mtime": "2022-10-17T11:03:54.845Z",
    "path": "../public/_nuxt/carousel-fc5da880.mjs"
  },
  "/_nuxt/default-8acaa593.mjs": {
    "type": "application/javascript",
    "etag": "\"11a7-9I9NaQgvoBbdAxCX0NyO3oOAsMs\"",
    "mtime": "2022-10-17T11:03:54.845Z",
    "path": "../public/_nuxt/default-8acaa593.mjs"
  },
  "/_nuxt/entry-84f9df31.mjs": {
    "type": "application/javascript",
    "etag": "\"5e38a-ddOrwTFaQs5OMVhvEwKbTE5EhWI\"",
    "mtime": "2022-10-17T11:03:54.844Z",
    "path": "../public/_nuxt/entry-84f9df31.mjs"
  },
  "/_nuxt/entry.57eac197.css": {
    "type": "text/css; charset=utf-8",
    "etag": "\"b51af-VtcB0zYmvQ+ldfkkySkhtuZL4Oo\"",
    "mtime": "2022-10-17T11:03:54.846Z",
    "path": "../public/_nuxt/entry.57eac197.css"
  },
  "/_nuxt/index-a56030b4.mjs": {
    "type": "application/javascript",
    "etag": "\"2b59-OyyYvz2fBnPSLt11qg6GR5Px0mw\"",
    "mtime": "2022-10-17T11:03:54.844Z",
    "path": "../public/_nuxt/index-a56030b4.mjs"
  },
  "/_nuxt/manifest.json": {
    "type": "application/json",
    "etag": "\"a43-/OYqK+V5VSl0TlbVoojkdjUCMg0\"",
    "mtime": "2022-10-17T11:03:54.846Z",
    "path": "../public/_nuxt/manifest.json"
  },
  "/_nuxt/materialdesignicons-webfont.5be9e9d7.eot": {
    "type": "application/vnd.ms-fontobject",
    "etag": "\"12aae0-GLTvA08q7BwIed5xQcHFnoNNCXU\"",
    "mtime": "2022-10-17T11:03:54.846Z",
    "path": "../public/_nuxt/materialdesignicons-webfont.5be9e9d7.eot"
  },
  "/_nuxt/materialdesignicons-webfont.633d596f.woff2": {
    "type": "font/woff2",
    "etag": "\"5d2f8-wtunkFhOlGmtjUyXdeCH4ix7aaA\"",
    "mtime": "2022-10-17T11:03:54.843Z",
    "path": "../public/_nuxt/materialdesignicons-webfont.633d596f.woff2"
  },
  "/_nuxt/materialdesignicons-webfont.7f3afe9b.woff": {
    "type": "font/woff",
    "etag": "\"872e8-V9C6Y3wg5NY7jDb4bLSGK4uK3ak\"",
    "mtime": "2022-10-17T11:03:54.846Z",
    "path": "../public/_nuxt/materialdesignicons-webfont.7f3afe9b.woff"
  },
  "/_nuxt/materialdesignicons-webfont.948fce52.ttf": {
    "type": "font/ttf",
    "etag": "\"12aa04-aOk3PGfYI4P3UxgCz4Ny3Zs6JXo\"",
    "mtime": "2022-10-17T11:03:54.846Z",
    "path": "../public/_nuxt/materialdesignicons-webfont.948fce52.ttf"
  },
  "/_nuxt/tables-5da8aa96.mjs": {
    "type": "application/javascript",
    "etag": "\"7b4-tAwsFvkTgqc6ZmDs5TEGohtRNYM\"",
    "mtime": "2022-10-17T11:03:54.845Z",
    "path": "../public/_nuxt/tables-5da8aa96.mjs"
  },
  "/images/background/assets.png": {
    "type": "image/png",
    "etag": "\"d19-dXQnW3ALjYiW7SiDdd7QlojOCK4\"",
    "mtime": "2020-10-26T12:50:26.000Z",
    "path": "../public/images/background/assets.png"
  },
  "/images/background/blog-bg-2x.jpg": {
    "type": "image/jpeg",
    "etag": "\"3eaa-bnuetCBPrfeIH9IEztTbEe6GpZQ\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/blog-bg-2x.jpg"
  },
  "/images/background/error-bg.jpg": {
    "type": "image/jpeg",
    "etag": "\"8c06-iu17M5ElFMjagjXeXCvXsOLI/vU\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/error-bg.jpg"
  },
  "/images/background/expense.png": {
    "type": "image/png",
    "etag": "\"aff-msKR1ftyVw6u4k3L8UIXOX/Zde8\"",
    "mtime": "2020-10-26T12:50:26.000Z",
    "path": "../public/images/background/expense.png"
  },
  "/images/background/income.png": {
    "type": "image/png",
    "etag": "\"a89-fEaoamfjG0dT224U9tkm9IENcV4\"",
    "mtime": "2020-10-26T12:50:26.000Z",
    "path": "../public/images/background/income.png"
  },
  "/images/background/login-register.jpg": {
    "type": "image/jpeg",
    "etag": "\"86061-YLOaGiXtD+JByHU5h/vDSKQtLOs\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/login-register.jpg"
  },
  "/images/background/profilebg.jpg": {
    "type": "image/jpeg",
    "etag": "\"286b-dM4wVw+xWVusp7F9KKGLfVyT1KQ\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/background/profilebg.jpg"
  },
  "/images/background/sidebar-buynow-bg.svg": {
    "type": "image/svg+xml",
    "etag": "\"6907-WEobvLeSUI1MCWppxaNjEJqRJOY\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/sidebar-buynow-bg.svg"
  },
  "/images/background/staff.png": {
    "type": "image/png",
    "etag": "\"b7e-Qy6vfB8kKMQiS4ABGM8hoVI6ILw\"",
    "mtime": "2020-10-26T12:50:26.000Z",
    "path": "../public/images/background/staff.png"
  },
  "/images/background/u1.jpg": {
    "type": "image/jpeg",
    "etag": "\"a444-XtHt6DDd4cYIe9e5VxkjaPdSMG4\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/u1.jpg"
  },
  "/images/background/u2.jpg": {
    "type": "image/jpeg",
    "etag": "\"ba24-dDeGuBMLvtiyk6sA7Rhxh4ULa/o\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/u2.jpg"
  },
  "/images/background/u3.jpg": {
    "type": "image/jpeg",
    "etag": "\"a1c7-CSEEU2KGvTCFjfWbcOBqkPgs0c8\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/u3.jpg"
  },
  "/images/background/u5.jpg": {
    "type": "image/jpeg",
    "etag": "\"d3c8-5iEhMvf2glSNKoKG/2QlcWPRCIY\"",
    "mtime": "2021-03-16T04:34:16.000Z",
    "path": "../public/images/background/u5.jpg"
  },
  "/images/background/user-info.jpg": {
    "type": "image/jpeg",
    "etag": "\"233c-8qNbFnBYpJiFkjDtoGjmoKBX5Yc\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/background/user-info.jpg"
  },
  "/images/background/weatherbg.jpg": {
    "type": "image/jpeg",
    "etag": "\"653e-VeqgpBWV+3tjZyxuDpeElYJmZkw\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/weatherbg.jpg"
  },
  "/images/background/welcome-bg-2x-svg.svg": {
    "type": "image/svg+xml",
    "etag": "\"1f7c8-QokBz7RKVVa1HDUrbCqCnZ1eb/E\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/welcome-bg-2x-svg.svg"
  },
  "/images/background/welcome-bg.png": {
    "type": "image/png",
    "etag": "\"6c19-xydhDGRRD5BUdHMA9FtfBRe31TY\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/welcome-bg.png"
  },
  "/images/background/welcome-bg2-2x-svg.svg": {
    "type": "image/svg+xml",
    "etag": "\"5536a-CbXqut4Le/9h6YelsPrh5SDplvw\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/background/welcome-bg2-2x-svg.svg"
  },
  "/images/big/blog-bg.jpg": {
    "type": "image/jpeg",
    "etag": "\"be25-crXLkJEAB4/QIjRyyWaESpGegv4\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/big/blog-bg.jpg"
  },
  "/images/big/img1.jpg": {
    "type": "image/jpeg",
    "etag": "\"84a3-xYCvTD7I5r4h2mWTdKUtD6bG9PQ\"",
    "mtime": "2022-05-07T05:12:24.000Z",
    "path": "../public/images/big/img1.jpg"
  },
  "/images/big/img2.jpg": {
    "type": "image/jpeg",
    "etag": "\"ddc4-r6QMl0x1YexOObSO43bRAT/klKk\"",
    "mtime": "2022-05-07T05:12:28.000Z",
    "path": "../public/images/big/img2.jpg"
  },
  "/images/big/img3.jpg": {
    "type": "image/jpeg",
    "etag": "\"e0a3-uhGWI2EzkpkHBG8cXwHbgzqaK9k\"",
    "mtime": "2022-05-07T05:12:32.000Z",
    "path": "../public/images/big/img3.jpg"
  },
  "/images/big/img4.jpg": {
    "type": "image/jpeg",
    "etag": "\"ea93-++duq1WrPXdJTxAIY0GUJskCQXg\"",
    "mtime": "2022-05-07T05:12:36.000Z",
    "path": "../public/images/big/img4.jpg"
  },
  "/images/browser/chrome-logo.png": {
    "type": "image/png",
    "etag": "\"962-rsr2IJM1eMAsrlqb5cwpAjPrZNE\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/browser/chrome-logo.png"
  },
  "/images/browser/firefox-logo.png": {
    "type": "image/png",
    "etag": "\"9e1-u0WMPzp2dyX9yd58Z80NxnFviag\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/browser/firefox-logo.png"
  },
  "/images/browser/internet-logo.png": {
    "type": "image/png",
    "etag": "\"958-mfFywomA0Qy8WyY28BGSuykQij8\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/browser/internet-logo.png"
  },
  "/images/browser/opera-logo.png": {
    "type": "image/png",
    "etag": "\"8dd-88/cx+MwCkDj2FvQnAOI7ansm0I\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/browser/opera-logo.png"
  },
  "/images/browser/photoshop.jpg": {
    "type": "image/jpeg",
    "etag": "\"8a9-3ZoJJUNMrWkMyovTvgQF37osQog\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/browser/photoshop.jpg"
  },
  "/images/browser/safari-logo.png": {
    "type": "image/png",
    "etag": "\"996-C3BH2KSGbhauopT3C66HZb9xuq4\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/browser/safari-logo.png"
  },
  "/images/browser/sketch.jpg": {
    "type": "image/jpeg",
    "etag": "\"9b3-sDUAfmzdVTChUUt9B3SyoBmaqF8\"",
    "mtime": "2020-10-26T12:50:42.000Z",
    "path": "../public/images/browser/sketch.jpg"
  },
  "/images/logos/dark-logo-icon.svg": {
    "type": "image/svg+xml",
    "etag": "\"2f9-+qqcyTvwMYcOl7G+KxvOzjHxG4U\"",
    "mtime": "2021-12-27T12:36:48.000Z",
    "path": "../public/images/logos/dark-logo-icon.svg"
  },
  "/images/logos/dark-logo-text.svg": {
    "type": "image/svg+xml",
    "etag": "\"d61-jKQIJfAC1pBVqDfDbfT7NblGPQI\"",
    "mtime": "2021-12-27T12:37:06.000Z",
    "path": "../public/images/logos/dark-logo-text.svg"
  },
  "/images/logos/white-logo-icon.svg": {
    "type": "image/svg+xml",
    "etag": "\"2f5-79VKJV4aaF5DdEQ/S/CwiQqPdqo\"",
    "mtime": "2021-12-27T12:36:56.000Z",
    "path": "../public/images/logos/white-logo-icon.svg"
  },
  "/images/logos/white-logo-text.svg": {
    "type": "image/svg+xml",
    "etag": "\"d16-QAWpjj+ekqj5cvaPH5TabW/Sb4A\"",
    "mtime": "2021-12-27T12:37:12.000Z",
    "path": "../public/images/logos/white-logo-text.svg"
  },
  "/images/products/1.jpg": {
    "type": "image/jpeg",
    "etag": "\"6a64-Yf8iaISBCKh1WP3Z8xxdFLi4YqY\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/products/1.jpg"
  },
  "/images/products/2.jpg": {
    "type": "image/jpeg",
    "etag": "\"600b-b51PH8X6wmNCf2C7GS3K0yXMoLg\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/products/2.jpg"
  },
  "/images/products/3.jpg": {
    "type": "image/jpeg",
    "etag": "\"c71a-aPPe1xbYC9yNOSP6zl52Awv30rk\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/products/3.jpg"
  },
  "/images/products/4.jpg": {
    "type": "image/jpeg",
    "etag": "\"2be7-W4qQE7I51vL1qKZjfGILjUsnHCI\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/products/4.jpg"
  },
  "/images/users/1.jpg": {
    "type": "image/jpeg",
    "etag": "\"1b35-dwWyYdJSMK6TyL+TquzoPikw/34\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/1.jpg"
  },
  "/images/users/2.jpg": {
    "type": "image/jpeg",
    "etag": "\"1dd2-XC2W8SH8aLo+EOaltDJFL70sW00\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/2.jpg"
  },
  "/images/users/3.jpg": {
    "type": "image/jpeg",
    "etag": "\"1e5c-EvUpq09To+kt+Hzr0iFMoT0ZInQ\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/3.jpg"
  },
  "/images/users/4.jpg": {
    "type": "image/jpeg",
    "etag": "\"206e-oQ5Wpfvzo8G/AvKhN1LlaCHxa9w\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/4.jpg"
  },
  "/images/users/5.jpg": {
    "type": "image/jpeg",
    "etag": "\"21fb-f55iSKzx9RoLxlasacAgsJhkhoQ\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/5.jpg"
  },
  "/images/users/6.jpg": {
    "type": "image/jpeg",
    "etag": "\"193f-HC11UAoAzDkkcwk8qiFpBbzQxsw\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/6.jpg"
  },
  "/images/users/7.jpg": {
    "type": "image/jpeg",
    "etag": "\"1fff-D4m3IfAcUIwUaH2l1ioZc3PDEL4\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/7.jpg"
  },
  "/images/users/8.jpg": {
    "type": "image/jpeg",
    "etag": "\"1c5c-ZZRd5ly6CN+hEyJX8qkjnxb3a0k\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/8.jpg"
  },
  "/images/users/astrro.png": {
    "type": "image/png",
    "etag": "\"1f17c-ZhRnTM0BnAg+8qLxwdvFfY8PMe8\"",
    "mtime": "2022-05-16T04:35:40.000Z",
    "path": "../public/images/users/astrro.png"
  },
  "/images/users/businessmen.png": {
    "type": "image/png",
    "etag": "\"255e5-hSnWf/qkRlAzMeUAnYGfxI/cvgk\"",
    "mtime": "2022-05-09T15:23:42.000Z",
    "path": "../public/images/users/businessmen.png"
  },
  "/images/users/happy.png": {
    "type": "image/png",
    "etag": "\"9866-9XOPJ3JmA5al+KQI5xt+Me084LQ\"",
    "mtime": "2022-05-16T04:37:08.000Z",
    "path": "../public/images/users/happy.png"
  },
  "/images/users/user.jpg": {
    "type": "image/jpeg",
    "etag": "\"107fd-mjcwL1qnLjrFtvtWzrF0N7Lcgko\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/user.jpg"
  },
  "/images/users/user2.jpg": {
    "type": "image/jpeg",
    "etag": "\"894-i4ojUlehEm7tWY705paW/aldQAk\"",
    "mtime": "2022-04-29T11:56:56.000Z",
    "path": "../public/images/users/user2.jpg"
  }
};

function readAsset (id) {
  const serverDir = dirname(fileURLToPath(globalThis._importMeta_.url));
  return promises.readFile(resolve(serverDir, assets[id].path))
}

const publicAssetBases = ["/_nuxt"];

function isPublicAssetURL(id = '') {
  if (assets[id]) {
    return true
  }
  for (const base of publicAssetBases) {
    if (id.startsWith(base)) { return true }
  }
  return false
}

function getAsset (id) {
  return assets[id]
}

const METHODS = ["HEAD", "GET"];
const _f4b49z = eventHandler(async (event) => {
  if (event.req.method && !METHODS.includes(event.req.method)) {
    return;
  }
  let id = decodeURIComponent(withLeadingSlash(withoutTrailingSlash(parseURL(event.req.url).pathname)));
  let asset;
  for (const _id of [id, id + "/index.html"]) {
    const _asset = getAsset(_id);
    if (_asset) {
      asset = _asset;
      id = _id;
      break;
    }
  }
  if (!asset) {
    if (isPublicAssetURL(id)) {
      throw createError({
        statusMessage: "Cannot find static asset " + id,
        statusCode: 404
      });
    }
    return;
  }
  const ifNotMatch = event.req.headers["if-none-match"] === asset.etag;
  if (ifNotMatch) {
    event.res.statusCode = 304;
    event.res.end("Not Modified (etag)");
    return;
  }
  const ifModifiedSinceH = event.req.headers["if-modified-since"];
  if (ifModifiedSinceH && asset.mtime) {
    if (new Date(ifModifiedSinceH) >= new Date(asset.mtime)) {
      event.res.statusCode = 304;
      event.res.end("Not Modified (mtime)");
      return;
    }
  }
  if (asset.type) {
    event.res.setHeader("Content-Type", asset.type);
  }
  if (asset.etag) {
    event.res.setHeader("ETag", asset.etag);
  }
  if (asset.mtime) {
    event.res.setHeader("Last-Modified", asset.mtime);
  }
  const contents = await readAsset(id);
  event.res.end(contents);
});

const _lazy_zU3aw9 = () => import('./renderer.mjs');

const handlers = [
  { route: '', handler: _f4b49z, lazy: false, middleware: true, method: undefined },
  { route: '/__nuxt_error', handler: _lazy_zU3aw9, lazy: true, middleware: false, method: undefined },
  { route: '/**', handler: _lazy_zU3aw9, lazy: true, middleware: false, method: undefined }
];

function createNitroApp() {
  const config = useRuntimeConfig();
  const hooks = createHooks();
  const h3App = createApp({
    debug: destr(false),
    onError: errorHandler
  });
  h3App.use(config.app.baseURL, timingMiddleware);
  const router = createRouter();
  const routerOptions = createRouter$1({ routes: config.nitro.routes });
  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler;
    const referenceRoute = h.route.replace(/:\w+|\*\*/g, "_");
    const routeOptions = routerOptions.lookup(referenceRoute) || {};
    if (routeOptions.swr) {
      handler = cachedEventHandler(handler, {
        group: "nitro/routes"
      });
    }
    if (h.middleware || !h.route) {
      const middlewareBase = (config.app.baseURL + (h.route || "/")).replace(/\/+/g, "/");
      h3App.use(middlewareBase, handler);
    } else {
      router.use(h.route, handler, h.method);
    }
  }
  h3App.use(config.app.baseURL, router);
  const localCall = createCall(h3App.nodeHandler);
  const localFetch = createFetch(localCall, globalThis.fetch);
  const $fetch = createFetch$1({ fetch: localFetch, Headers, defaults: { baseURL: config.app.baseURL } });
  globalThis.$fetch = $fetch;
  const app = {
    hooks,
    h3App,
    router,
    localCall,
    localFetch
  };
  for (const plugin of plugins) {
    plugin(app);
  }
  return app;
}
const nitroApp = createNitroApp();

const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
const server = cert && key ? new Server({ key, cert }, nitroApp.h3App.nodeHandler) : new Server$1(nitroApp.h3App.nodeHandler);
const port = destr(process.env.NITRO_PORT || process.env.PORT) || 3e3;
const hostname = process.env.NITRO_HOST || process.env.HOST || "0.0.0.0";
server.listen(port, hostname, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const protocol = cert && key ? "https" : "http";
  console.log(`Listening on ${protocol}://${hostname}:${port}${useRuntimeConfig().app.baseURL}`);
});
{
  process.on("unhandledRejection", (err) => console.error("[nitro] [dev] [unhandledRejection] " + err));
  process.on("uncaughtException", (err) => console.error("[nitro] [dev] [uncaughtException] " + err));
}
const nodeServer = {};

export { nodeServer as n, useRuntimeConfig as u };
//# sourceMappingURL=node-server.mjs.map
