import { existsSync, readFileSync, writeFileSync } from "node:fs";

const source = "dist/index.html";
const target = "dist/404.html";

if (existsSync(source)) {
  const indexHtml = readFileSync(source, "utf8");
  const basePathMatch = indexHtml.match(/(?:src|href)="([^"]*?)assets\//);
  const basePath = basePathMatch?.[1] ?? "/";

  const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="refresh" content="0;url=${basePath}" />
    <title>Teacher Dashboard</title>
    <script>
      (function () {
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        const redirectTarget = currentPath.startsWith(${JSON.stringify(basePath)})
          ? currentPath
          : ${JSON.stringify(basePath)};

        window.location.replace(${JSON.stringify(basePath)} + "?redirect=" + encodeURIComponent(redirectTarget));
      })();
    </script>
  </head>
  <body></body>
</html>
`;

  writeFileSync(target, fallbackHtml);
}