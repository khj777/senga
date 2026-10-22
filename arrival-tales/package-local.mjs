import {readFile,writeFile} from 'node:fs/promises';
const [html,css,engine,app]=await Promise.all(['dist/index.html','dist/styles.css','dist/engine.mjs','dist/app.mjs'].map(file=>readFile(new URL(file,import.meta.url),'utf8')));
const standalone=html
  .replace('<link rel="stylesheet" href="styles.css">',`<style>${css}</style>`)
  .replace('<script type="module" src="app.mjs"></script>',`<script type="module">\n${engine}\n${app.replace("import { STORY, planStory } from './engine.mjs';",'')}\n</script>`);
const output=new URL('도착동화-시제품.html',import.meta.url);
await writeFile(output,standalone,'utf8');
console.log('Standalone prototype: '+output.pathname);
