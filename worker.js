export default {
  async fetch(request, { allowedOrigins }) {
    const { url, source, keepOrigin } = Object.fromEntries(
      new URL(request.url).searchParams
    );
    const sourceOrigin = new URL(source ?? "https://invalid.invalid").origin;
    if (!allowedOrigins.includes(sourceOrigin)) {
      return new Response("forbidden", { status: 421 });
    }
    const origin = request.headers.get("origin");
    if (!allowedOrigins.includes(origin)) {
      return new Response("wrong", { status: 421 });
    }
    const allowedUrls = (await (await fetch(source)).text()).match(
      /(?<=^\s*\/\/\s*proxy:\s*)\S*(?=\s*$)/gim
    );
    if (!allowedUrls?.some((v) => new URLPattern(v).test(url))) {
      return Response.json(allowedUrls, { status: 421 });
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
    const res = await fetch(request2);
    const res2 = new Response(res.body, res);
    res2.headers.append("access-control-allow-origin", "*");
    return res2;
  },
};
