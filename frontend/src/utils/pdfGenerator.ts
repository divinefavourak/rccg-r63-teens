// src/utils/pdfGenerator.ts
//
// html2canvas + jsPDF are ~600KB together. Importing them at module scope made
// TicketPreview a 614KB chunk — larger than the entire application entry — even
// though the code only runs when someone taps Download. Both are now pulled in
// on first use via dynamic import(), so Rollup emits them as separate chunks
// that a visitor who never downloads a ticket never fetches.
//
// The two libraries are loaded in parallel and the module promise is cached, so
// a second download does not re-await the network.

let libsPromise: Promise<{
  html2canvas: typeof import('html2canvas').default;
  jsPDF: typeof import('jspdf').default;
}> | null = null;

function loadLibs() {
  if (!libsPromise) {
    libsPromise = Promise.all([import('html2canvas'), import('jspdf')])
      .then(([h, j]) => ({ html2canvas: h.default, jsPDF: j.default }))
      .catch((error) => {
        // Clear the cache so a transient network failure can be retried rather
        // than permanently poisoning every later download attempt.
        libsPromise = null;
        throw error;
      });
  }
  return libsPromise;
}

const CAPTURE_OPTIONS = {
  scale: 3, // High resolution
  useCORS: true,
  logging: false,
  backgroundColor: '#ffffff', // Force white background
} as const;

export const generateImage = async (elementId: string, fileName: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const { html2canvas } = await loadLibs();
    const canvas = await html2canvas(element, { ...CAPTURE_OPTIONS });

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Error generating image:', error);
    alert('Failed to generate image.');
  }
};

export const generatePDF = async (elementId: string, fileName: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id '${elementId}' not found`);
    return;
  }

  try {
    const { html2canvas, jsPDF } = await loadLibs();

    // 1. High-res capture
    const canvas = await html2canvas(element, { ...CAPTURE_OPTIONS });

    const imgData = canvas.toDataURL('image/png');

    // 2. Setup PDF (A4 Landscape or Portrait based on content?)
    // Ticket is usually landscape-ish. Let's force Portrait A4 and fit width.
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Center vertically if it's smaller than page height
    let yPos = 0;
    if (imgHeight < pdfHeight) {
      yPos = (pdfHeight - imgHeight) / 2;
    }

    pdf.addImage(imgData, 'PNG', 0, yPos, imgWidth, imgHeight);
    pdf.save(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
};
