#!/usr/bin/env -S deno run --allow-env --allow-net

globalThis.Deno?.serve((request) => worker.fetch(request, Deno.env.toObject()));

export default class worker {
  static async fetch(/** @type {Request} */ request, { allowedOrigins = [] }) {
    if (typeof allowedOrigins === "string") {
      allowedOrigins = JSON.parse(allowedOrigins);
    }
    const { url, redirect = "follow", source, keepOrigin } = Object.fromEntries(
      new URL(request.url).searchParams
    );
    const sourceOrigin = new URL(source ?? "https://invalid.invalid").origin;
    if (!allowedOrigins.includes(sourceOrigin)) {
      return new Response("forbidden", { status: 421 });
    }
    const origin = request.headers.get("origin");
    if (origin !== sourceOrigin) {
      return new Response("wrong", { status: 421 });
    }
    const allowedUrls = (await (await fetch(source)).text()).match(
      /(?<=^\s*\/\/\s*proxy-allow:\s*)\S*(?=\s*$)/gim
    );
    if (!allowedUrls?.some((v) => new URLPattern(v).test(url))) {
      return Response.json(allowedUrls, { status: 421 });
    }
    if (globalThis.Deno && request.headers.get("upgrade") === "websocket") {
      const socket2 = new WebSocket(
        url,
        request.headers.get("sec-websocket-protocol")?.split(",").map((v) =>
          v.trim()
        ),
      );
      await new Promise((resolve, reject) => {
        socket2.onopen = resolve;
        socket2.onerror = reject;
      });
      const { socket, response } = Deno.upgradeWebSocket(
        request,
        socket2.protocol,
      );
      socket.onmessage = (event) => socket2.send(event.data);
      socket2.onmessage = (event) => socket.send(event.data);
      const normalizeCode = (code) =>
        code === 1000 || (3000 <= code && code <= 4999) ? code : 1000;
      socket.onclose = (event) =>
        socket2.close(normalizeCode(event.code), event.reason);
      socket2.onclose = (event) => socket.close(event.code, event.reason);
      return response;
    }
    const request2 = new Request(url.replace(/^wss:\/\//, "https://"), request);
    for (const [k, v] of request2.headers) {
      if (
        k.startsWith("cf-") ||
        k.startsWith("x-forwarded-") ||
        k === "x-real-ip" ||
        (k === "origin" && !keepOrigin)
      ) {
        request2.headers.delete(k);
      }
    }
    const res = await fetch(request2, { redirect });
    const res2 = new Response(res.body, res);
    if (res2.status >= 300 && res2.status <= 399) {
       if (res2.headers.has("location")) {
          const url = new URL(request.url);
          url.searchParams.set("url", new URL(res2.headers.get("location"), res.url));
          res2.headers.set("location", url);
       }
    }
    res2.headers.append("access-control-allow-origin", "*");
    return res2;
  }
}
