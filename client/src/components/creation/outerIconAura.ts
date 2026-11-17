/** Halo calculado só no exterior conectado às bordas; vazados internos ficam transparentes. */
const cache = new Map<string, Promise<string>>();
export function outerIconAura(src: string): Promise<string> {
  const existing = cache.get(src);
  if (existing) return existing;
  const pending = render(src);
  cache.set(src, pending);
  pending.catch(() => cache.delete(src));
  return pending;
}
async function render(src: string): Promise<string> {
  const image = new Image(); image.src = src; await image.decode();
  const size = 256, padding = 28, side = size + padding * 2;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = side;
  const ctx = canvas.getContext('2d')!;
  const scale = size / Math.max(image.width, image.height);
  ctx.drawImage(image, (side - image.width * scale) / 2, (side - image.height * scale) / 2, image.width * scale, image.height * scale);
  const pixels = ctx.getImageData(0, 0, side, side);
  const exterior = new Uint8Array(side * side), queue = new Int32Array(side * side);
  let head = 0, tail = 1; queue[0] = 0; exterior[0] = 1;
  const visit = (index: number) => {
    if (!exterior[index] && pixels.data[index * 4 + 3] < 32) { exterior[index] = 1; queue[tail++] = index; }
  };
  while (head < tail) {
    const index = queue[head++], x = index % side;
    if (x > 0) visit(index - 1);
    if (x < side - 1) visit(index + 1);
    if (index >= side) visit(index - side);
    if (index < side * (side - 1)) visit(index + side);
  }
  // A silhueta inclui os furos fechados. Depois do blur, retira-se toda essa área.
  for (let i = 0; i < exterior.length; i++) {
    pixels.data[i * 4] = 222; pixels.data[i * 4 + 1] = 177; pixels.data[i * 4 + 2] = 78;
    pixels.data[i * 4 + 3] = exterior[i] ? 0 : 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const glow = document.createElement('canvas'); glow.width = glow.height = side;
  const output = glow.getContext('2d')!;
  output.filter = 'blur(8px)'; output.globalAlpha = .55; output.drawImage(canvas, 0, 0);
  output.filter = 'blur(3px)'; output.globalAlpha = .4; output.drawImage(canvas, 0, 0);
  output.filter = 'none'; output.globalAlpha = 1;
  const result = output.getImageData(0, 0, side, side);
  for (let i = 0; i < exterior.length; i++) if (!exterior[i]) result.data[i * 4 + 3] = 0;
  output.putImageData(result, 0, 0);
  return glow.toDataURL();
}
