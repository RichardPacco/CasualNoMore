/**
 * Baixa os ícones dos consoles do RetroAchievements para dentro do projeto.
 *
 *   PowerShell:  $env:RA_API_KEY="<sua Web API Key>"; node scripts/fetch-console-icons.mjs
 *   bash:        RA_API_KEY=<sua Web API Key> node scripts/fetch-console-icons.mjs
 *
 * 1. Busca a lista de consoles (API_GetConsoleIDs, só sistemas de jogos).
 * 2. Salva o ícone de cada um em assets/images/consoles/<id>.png.
 * 3. Gera src/platforms/ra/consoleIconAssets.js: { [consoleId]: require(...) }.
 *
 * O app usa só esses arquivos (nenhuma chamada à API em tempo de uso). Rode
 * de novo quando o RetroAchievements adicionar consoles. A key só é usada
 * nesta execução: não é salva em lugar nenhum nem aparece na saída.
 */
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = join(ROOT, "assets", "images", "consoles");
const OUT_FILE = join(ROOT, "src", "platforms", "ra", "consoleIconAssets.js");

const key = process.env.RA_API_KEY?.trim();
if (!key) {
    console.error("Informe a key: $env:RA_API_KEY=\"...\"; node scripts/fetch-console-icons.mjs");
    process.exit(1);
}

// g=1: só sistemas de jogos (sem Hubs/Events); a=0: inclui os inativos, que
// podem aparecer em bibliotecas antigas
const res = await fetch(`https://retroachievements.org/API/API_GetConsoleIDs.php?y=${encodeURIComponent(key)}&a=0&g=1`);
if (!res.ok) {
    console.error(`GetConsoleIDs falhou: HTTP ${res.status}${res.status === 401 ? " (key inválida)" : ""}`);
    process.exit(1);
}
const consoles = (await res.json())
    .filter(c => c?.ID && c?.IconURL)
    .sort((a, b) => a.ID - b.ID);

await mkdir(ICONS_DIR, { recursive: true });

const saved = [];
for (const c of consoles) {
    try {
        const img = await fetch(c.IconURL);
        if (!img.ok) throw new Error(`HTTP ${img.status}`);
        await writeFile(join(ICONS_DIR, `${c.ID}.png`), Buffer.from(await img.arrayBuffer()));
        saved.push(c);
        console.log(`✔ ${c.ID} ${c.Name}`);
    } catch (err) {
        console.warn(`✘ ${c.ID} ${c.Name}: ${err.message}`);
    }
}

const lines = saved.map(c => `    ${c.ID}: require("../../../assets/images/consoles/${c.ID}.png"), // ${c.Name}`);
await writeFile(OUT_FILE, `// Gerado por scripts/fetch-console-icons.mjs: não editar à mão.
// Ícones dos consoles do RetroAchievements, por ID do console.
const CONSOLE_ICON_ASSETS = {
${lines.join("\n")}
};

export default CONSOLE_ICON_ASSETS;
`);

console.log(`\n${saved.length} de ${consoles.length} ícones salvos em assets/images/consoles/`);
console.log("Mapa gerado em src/platforms/ra/consoleIconAssets.js");
