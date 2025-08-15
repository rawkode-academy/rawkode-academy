const port = process.env.PORT || 3000;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === "/" || url.pathname.includes("?code=")) {
      return new Response(Bun.file("./public/index.html"), {
        headers: { "Content-Type": "text/html" }
      });
    }
    
    if (url.pathname === "/app.js") {
      return new Response(Bun.file("./public/app.js"), {
        headers: { "Content-Type": "application/javascript" }
      });
    }
    
    if (url.pathname === "/styles.css") {
      return new Response(Bun.file("./public/styles.css"), {
        headers: { "Content-Type": "text/css" }
      });
    }
    
    return new Response("Not Found", { status: 404 });
  }
});

console.log(`Server running at http://localhost:${port}`);