// Paints rooms off the main thread, so the page and the TV never freeze while a style is being drawn.
// Message in: { id, name, rect, z } — the room, the part of it to paint (room units) and device pixels per unit.
// Message out: { id, bitmap }.
self.onmessage = async ({ data: { id, name, rect, z } }) => {
  const { drawRoom } = await import(`./rooms/${name}.js`);
  const canvas = new OffscreenCanvas(Math.round(rect.w * z), Math.round(rect.h * z));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(z, 0, 0, z, -rect.x * z, -rect.y * z);
  drawRoom(ctx);
  const bitmap = canvas.transferToImageBitmap();
  self.postMessage({ id, bitmap }, [bitmap]);
};
