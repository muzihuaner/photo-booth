export class Exporter {
  getCanvasDataUrl(canvas, format = 'image/png', quality = 0.95) {
    return canvas.toDataURL(format, quality);
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadPng(canvas) {
    const link = document.createElement('a');
    link.download = `photo-booth-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  print(canvas, printImgElement) {
    printImgElement.src = canvas.toDataURL('image/png');
    setTimeout(() => window.print(), 100);
  }

  async savePdf(canvas, filename = `photo-booth-${Date.now()}.pdf`) {
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const cw = canvas.width;
    const ch = canvas.height;
    const aspectRatio = cw / ch;

    const pdf = new jsPDF({
      orientation: aspectRatio > 1 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    let imgW, imgH;

    if (cw / ch > pdfW / pdfH) {
      imgW = pdfW;
      imgH = pdfW / aspectRatio;
    } else {
      imgH = pdfH;
      imgW = pdfH * aspectRatio;
    }

    const x = (pdfW - imgW) / 2;
    const y = (pdfH - imgH) / 2;

    pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
    pdf.save(filename);
  }
}
