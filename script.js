let pdfDoc = null;
let scale = 1.5;
let pdfContainer = document.getElementById('pdfContainer');
let textboxes = [];
let addTextMode = false;
let currentFontSize = 12; // Default font size

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
  textbox.style.fontSize = `${currentFontSize}px`; // Apply selected font size

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

// Update font size when user selects a new size
document.getElementById('fontSize').addEventListener('change', (e) => {
  currentFontSize = parseInt(e.target.value);

  // Update font size for the selected textbox
  const selectedTextbox = document.querySelector('.selected-textbox');
  if (selectedTextbox) {
    selectedTextbox.style.fontSize = `${currentFontSize}px`;
  }
});

// Select a textbox and update the font size dropdown
pdfContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('textbox')) {
    const selectedTextbox = e.target;

    // Add or remove the 'selected-textbox' class
    document.querySelectorAll('.textbox').forEach((textbox) => {
      textbox.classList.remove('selected-textbox');
    });

    selectedTextbox.classList.add('selected-textbox');

    // Update font size dropdown
    const fontSize = parseInt(getComputedStyle(selectedTextbox).fontSize);
    document.getElementById('fontSize').value = fontSize;
  }
});

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

    const fontSize = parseFloat(getComputedStyle(div).fontSize);
    const text = div.innerText || 'Text';

    const x = xPercent * width;
    const y = height - (yPercent * height) - fontSize;

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font: await pdfDocLib.embedFont(PDFLib.StandardFonts.Helvetica),
    });
  }

  const pdfBytes = await pdfDocLib.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'edited.pdf';
  link.click();
});
