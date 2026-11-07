(function (root) {
  'use strict';
  function layoutCovers(ratios, width, category, minHeight = 0) {
    if (!ratios.length || width <= 0) return {tiles: [], height: 0};
    const tiles = [];
    const album = category === 'albums';
    const columns = Math.max(2, Math.round(width / (width < 600 ? 170 : 250)));
    const target = category === 'books' ? (width < 600 ? 235 : 330) : (width < 600 ? 205 : 300);
    let height = 0, cursor = 0, row = 0;
    do {
      const indices = [];
      let sum = 0;
      const desired = album ? width / columns : target * ([1, .84, 1.14][row % 3]);
      do {
        const index = cursor++ % ratios.length;
        indices.push(index);
        sum += ratios[index];
      } while (album ? indices.length < columns : sum * desired < width);
      const rowHeight = width / sum;
      let x = 0;
      for (const index of indices) {
        const tileWidth = rowHeight * ratios[index];
        tiles.push({index, x, y: height, width: tileWidth, height: rowHeight});
        x += tileWidth;
      }
      height += rowHeight;
      row++;
    } while (cursor < ratios.length || height < minHeight);
    return {tiles, height};
  }
  function wrapOffset(offset, period) {
    if (period <= 0) return 0;
    const remainder = ((offset % period) + period) % period;
    // Scroll positions are quantized to device subpixels in browsers.
    return period + (remainder < .5 || period - remainder < .5 ? 0 : remainder);
  }
  function locateAnchor(layout, keys, offset) {
    const slot = layout.tiles.findIndex(tile => tile.y + tile.height > offset);
    const tile = layout.tiles[Math.max(0, slot)];
    const occurrence = layout.tiles.slice(0, Math.max(0, slot)).filter(previous => previous.index === tile.index).length;
    return {key: keys[tile.index], occurrence, fraction: (offset - tile.y) / tile.height};
  }
  function restoreAnchor(layout, keys, anchor) {
    const matches = layout.tiles.filter(tile => keys[tile.index] === anchor?.key);
    const occurrence = Number.isInteger(anchor?.occurrence) ? Math.max(0, anchor.occurrence) : 0;
    const tile = matches[Math.min(occurrence, matches.length - 1)];
    const fraction = Number.isFinite(anchor?.fraction) ? Math.max(0, Math.min(1, anchor.fraction)) : 0;
    return tile ? tile.y + tile.height * fraction : 0;
  }
  const api = {layoutCovers, wrapOffset, locateAnchor, restoreAnchor};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CollectionLayout = api;
})(globalThis);
