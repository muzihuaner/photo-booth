import { TEMPLATES } from './config.js';

export class TemplateRenderer {
  constructor() {
    this.templates = TEMPLATES;
  }

  getTemplates() {
    return this.templates;
  }

  getTemplate(id) {
    return this.templates.find(t => t.id === id);
  }

  render(templateId, photos, customText = '', options = {}) {
    const template = this.getTemplate(templateId);
    if (!template) throw new Error(`Template "${templateId}" not found`);

    const cw = template.canvasWidth;
    const ch = template.canvasHeight;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    this._drawBackground(ctx, template, cw, ch);
    this._drawPhotos(ctx, template, photos, cw, ch);
    this._drawDecorations(ctx, template, cw, ch);

    if (customText) {
      this._drawCustomText(ctx, customText, cw, ch, template.customTextY || 0.88);
    }

    if (options.showTimestamp && options.timestampText) {
      this._drawTimestamp(ctx, options.timestampText, cw, ch);
    }

    return canvas;
  }

  _drawBackground(ctx, template, cw, ch) {
    ctx.fillStyle = template.bgColor || '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
  }

  _drawPhotos(ctx, template, photos, cw, ch) {
    const maxToDraw = Math.min(template.maxPhotos, photos.length);
    for (let i = 0; i < maxToDraw; i++) {
      const slot = template.photoSlots[i];
      const photo = photos[i];
      if (!slot || !photo) continue;

      const dx = slot.x * cw;
      const dy = slot.y * ch;
      const dw = slot.w * cw;
      const dh = slot.h * ch;

      let srcCanvas;
      if (photo instanceof HTMLCanvasElement) {
        srcCanvas = photo;
      } else if (photo instanceof HTMLImageElement) {
        const c = document.createElement('canvas');
        c.width = photo.naturalWidth;
        c.height = photo.naturalHeight;
        c.getContext('2d').drawImage(photo, 0, 0);
        srcCanvas = c;
      } else {
        continue;
      }

      this._drawImageCover(ctx, srcCanvas, dx, dy, dw, dh);

      const borderColor = template.photoBorder || null;
      if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, dw, dh);
      }
    }
  }

  _drawImageCover(ctx, src, dx, dy, dw, dh) {
    const sw = src.width;
    const sh = src.height;

    const srcAspect = sw / sh;
    const dstAspect = dw / dh;

    let sx, sy, sWidth, sHeight;

    if (srcAspect > dstAspect) {
      sHeight = sh;
      sWidth = sh * dstAspect;
      sx = (sw - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = sw;
      sHeight = sw / dstAspect;
      sx = 0;
      sy = (sh - sHeight) / 2;
    }

    ctx.drawImage(src, sx, sy, sWidth, sHeight, dx, dy, dw, dh);
  }

  _drawDecorations(ctx, template, cw, ch) {
    const decors = template.decorations || [];
    for (const d of decors) {
      switch (d.type) {
        case 'rect':
          this._drawRect(ctx, d, cw, ch);
          break;
        case 'text':
          this._drawText(ctx, d, cw, ch);
          break;
        case 'line':
          this._drawLine(ctx, d, cw, ch);
          break;
        case 'circle':
          this._drawCircle(ctx, d, cw, ch);
          break;
      }
    }
  }

  _drawRect(ctx, d, cw, ch) {
    const x = d.x * cw;
    const y = d.y * ch;
    const w = d.w * cw;
    const h = d.h * ch;

    if (d.fill) {
      ctx.fillStyle = d.fill;
      ctx.fillRect(x, y, w, h);
    }
    if (d.stroke) {
      ctx.strokeStyle = d.stroke;
      ctx.lineWidth = d.lineWidth || 1;
      ctx.strokeRect(x, y, w, h);
    }
  }

  _drawText(ctx, d, cw, ch) {
    const x = d.x * cw;
    const y = d.y * ch;

    ctx.font = d.font || '24px sans-serif';
    ctx.fillStyle = d.color || '#333';
    ctx.textAlign = d.align || 'left';
    ctx.textBaseline = d.baseline || 'top';
    ctx.fillText(d.text, x, y);
  }

  _drawLine(ctx, d, cw, ch) {
    ctx.strokeStyle = d.stroke || '#ddd';
    ctx.lineWidth = d.lineWidth || 1;
    ctx.beginPath();
    ctx.moveTo(d.x1 * cw, d.y1 * ch);
    ctx.lineTo(d.x2 * cw, d.y2 * ch);
    ctx.stroke();
  }

  _drawTimestamp(ctx, text, cw, ch) {
    ctx.save();
    ctx.font = '18px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    const x = cw - 16;
    const y = ch - 14;

    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(60,50,40,0.45)';
    ctx.fillText(text, x, y);

    ctx.shadowColor = 'transparent';
    ctx.fillText(text, x - 1, y - 1);
    ctx.restore();
  }

  _drawCustomText(ctx, text, cw, ch, yRatio = 0.88) {
    ctx.save();
    const fontSize = Math.min(26, Math.round(cw / 34));
    const lineHeight = fontSize + 10;
    const lines = text.split('\n');
    const blockH = lines.length * lineHeight;
    const baseY = ch * yRatio;
    const startY = baseY + blockH / 2;

    ctx.font = `${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 2;

    ctx.fillStyle = 'rgba(60,50,40,0.45)';
    lines.forEach((line, i) => {
      ctx.fillText(line, cw / 2, startY - (lines.length - 1 - i) * lineHeight);
    });

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(60,50,40,0.55)';
    lines.forEach((line, i) => {
      ctx.fillText(line, cw / 2 - 0.5, startY - (lines.length - 1 - i) * lineHeight - 0.5);
    });
    ctx.restore();
  }

  _drawCircle(ctx, d, cw, ch) {
    const cx = d.x * cw;
    const cy = d.y * ch;
    const r = d.r * Math.min(cw, ch);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (d.fill) {
      ctx.fillStyle = d.fill;
      ctx.fill();
    }
    if (d.stroke) {
      ctx.strokeStyle = d.stroke;
      ctx.lineWidth = d.lineWidth || 1;
      ctx.stroke();
    }
  }
}
