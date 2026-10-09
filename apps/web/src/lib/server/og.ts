import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cached: Buffer | null = null;
/** Brand serif for share images (Source Serif 4, SIL Open Font License). */
export async function ogFonts() {
  cached ??= await readFile(join(process.cwd(), "assets/SourceSerif4-Bold.woff"));
  return [{ name: "Source Serif", data: cached, weight: 700 as const, style: "normal" as const }];
}
