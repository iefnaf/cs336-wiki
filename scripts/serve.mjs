import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.xml':'application/xml'};
const server = http.createServer(async (req,res) => {
  try {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(dist, '.' + route);
    if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
    try { if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html'); }
    catch { res.writeHead(404, {'Content-Type':mime['.html']}); res.end(await fs.readFile(path.join(dist,'404.html'))); return; }
    const body = await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}); res.end(body);
  } catch { res.writeHead(500); res.end('Server error'); }
});
server.listen(3360,'127.0.0.1',() => console.log('Local: http://127.0.0.1:3360'));
