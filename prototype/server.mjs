import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/model.mjs':'model.mjs','/styles.css':'styles.css'};
const types={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css'};
const port=Number(process.env.PORT||5173);
http.createServer(async(req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404).end('Not found');return;}try{const body=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').pop()]+'; charset=utf-8','Cache-Control':'no-cache'}).end(body);}catch{res.writeHead(500).end('Unable to load file');}}).listen(port,'127.0.0.1',()=>console.log(`UWFlow prototype: http://localhost:${port}`));
