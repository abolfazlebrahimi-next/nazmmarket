import sharp from "sharp";
import fs from "node:fs/promises";
export async function normalizeImage(file, square = false) {
  const pipeline = sharp(file.path, { limitInputPixels: 25000000 }).rotate();
  const buffer = await (
    square
      ? pipeline.resize(1000, 1000, { fit: "contain", background: "#ffffff" })
      : pipeline.resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
  )
    .jpeg({ quality: 88 })
    .toBuffer();
  await fs.writeFile(file.path, buffer, { mode: 0o600 });
  return file;
}
