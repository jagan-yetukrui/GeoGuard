import { removeBackground } from "@imgly/background-removal-node";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const inputPath = path.join(root, "Gemini_Generated_Image_34kktm34kktm34kk.png");
const outputPath = path.join(root, "public", "geoguard-logo.png");

console.log("Removing background from", inputPath);
console.log("(First run may download ~80MB model; this can take a minute.)\n");

const blob = await removeBackground(inputPath);
const buffer = Buffer.from(await blob.arrayBuffer());
fs.writeFileSync(outputPath, buffer);
console.log("Done. Saved transparent logo to", outputPath);
