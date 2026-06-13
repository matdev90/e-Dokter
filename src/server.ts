import { serve } from "bun";

// Simple health check endpoint
serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/ping") {
      return new Response("pong", { status: 200 });
    }
    return new Response("Not Found", { status: 404 });
  },
});
