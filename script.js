let pdfDoc = null;
let scale = 1.5;
let pdfContainer = document.getElementById('pdfContainer');
let textboxes = [];
let addTextMode = false;

// Load PDF
document.getElementById('pdfUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.onload = async function () {
    const typedarray = new Uint8Array(this.result);

    const loadingTask = pdfjsLib.getDocument({ data: typedarray });
    pdfDoc = await loadingTask.promise;

    pdfContainer.innerHTML = '';
    textboxes = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';
      pageDiv.style.width = canvas.width + 'px';
      pageDiv.style.height = canvas.height + 'px';
      pageDiv.appendChild(canvas);
      pdfContainer.appendChild(pageDiv);
    }
  };

  fileReader.readAsArrayBuffer(file);
});

// Add Text Mode Button
document.getElementById('addTextBtn').addEventListener('click', () => {
  addTextMode = true;
});

// Handle placing text box
pdfContainer.addEventListener('click', (e) => {
  if (!addTextMode) return;

  const pageDiv = e.target.closest('.pdf-page');
  if (!pageDiv) return;

  const rect = pageDiv.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const textbox = document.createElement('div');
  textbox.className = 'textbox';
  textbox.contentEditable = true;
  textbox.innerText = 'Text';
  textbox.style.left = `${x}px`;
  textbox.style.top = `${y}px`;
  textbox.style.fontSize = '12px'; // match PDF font size

  pageDiv.appendChild(textbox);

  textboxes.push({ div: textbox, pageDiv });
  makeDraggable(textbox);

  addTextMode = false;
});

// Make textbox draggable
function makeDraggable(element) {
  let isDragging = false;
  let offsetX, offsetY;

  element.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    element.style.zIndex = 1000;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const parent = element.parentElement.getBoundingClientRect();
    element.style.left = `${e.clientX - parent.left - offsetX}px`;
    element.style.top = `${e.clientY - parent.top - offsetY}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    element.style.zIndex = '';
  });
}

// Download Edited PDF
document.getElementById('downloadBtn').addEventListener('click', async () => {
  if (!pdfDoc) return;

  const file = document.getElementById('pdfUpload').files[0];
  const arrayBuffer = await file.arrayBuffer();
  const pdfDocLib = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = pdfDocLib.getPages();

  for (const { div, pageDiv } of textboxes) {
    const pageIndex = Array.from(pdfContainer.children).indexOf(pageDiv);
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    const canvas = pageDiv.querySelector('canvas');
    const pageRect = canvas.getBoundingClientRect();

    const xPercent = parseFloat(div.style.left) / pageRect.width;
    const yPercent = parseFloat(div.style.top) / pageRect.height;

    // Get the font size from the text box in pixels
    const fontSizePx = parseFloat(getComputedStyle(div).fontSize);

    // Convert the font size from pixels to PDF points (PDF uses points)
    const fontSizePoints = fontSizePx * (72 / 96); // Conversion from pixels (96 DPI) to points (72 DPI)

    const text = div.innerText || 'Text';

    const x = xPercent * width;
    const y = height - (yPercent * height) - fontSizePoints;

    // Use Helvetica as the font
    page.drawText(text, {
      x,
      y,
      size: fontSizePoints,
      font: await pdfDocLib.embedFont(PDFLib.StandardFonts.Helvetica), // Embed font if needed
    });
  }

  const pdfBytes = await pdfDocLib.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'edited.pdf';
  link.click();
});
