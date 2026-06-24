import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const publishDir = path.resolve(process.argv[2] || path.join(repoRoot, "public"));
const chromePath = process.env.CHROME_BIN;

if (!chromePath) {
  throw new Error("CHROME_BIN is required.");
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".otf": "font/otf",
  ".png": "image/png",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const relativePath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(publishDir, `.${relativePath}`);

  if (!filePath.startsWith(publishDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
});

await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));

try {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 }, deviceScaleFactor: 1 });

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.body.classList.add("render-assets"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const lead = document.querySelector('[data-field="lead"]')?.textContent || "";
    return lead.includes("美国") || lead.length > 20;
  });

  await page.pdf({
    path: path.join(publishDir, "flora-daily.pdf"),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await page.addStyleTag({
    content: `
      .template-toolbar { display: none !important; }
      body { padding: 0 !important; background: #fbfaf5 !important; }
      .page { box-shadow: none !important; border: 0 !important; }
    `,
  });
  const pageBox = await page.locator(".page").boundingBox();
  await page.screenshot({
    path: path.join(publishDir, "flora-daily.png"),
    clip: pageBox || undefined,
    fullPage: !pageBox,
  });

  await browser.close();
} finally {
  await new Promise((resolve) => server.close(resolve));
}
