// src/utils/pdfGenerator.ts
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const generatePDF = async (elementId: string, fileName: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id '${elementId}' not found`);
    return;
  }

  try {
    // 1. Create a canvas from the HTML element
    const canvas = await html2canvas(element, {
      scale: 2, // Increases resolution for better quality
      useCORS: true, // Allows loading cross-origin images
      logging: false,
      backgroundColor: '#ffffff', // Ensures background is white, not transparent
      ignoreElements: (node) => {
        // Optional: Ignore specific elements like buttons if they are inside the container
        return node.classList.contains('no-print');
      }
    });

    // 2. Calculate PDF dimensions (A4)
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // 3. Add image to PDF
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    // 4. Save
    pdf.save(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
};