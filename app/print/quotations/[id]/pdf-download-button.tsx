"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function PdfDownloadButton({
  fileName,
}: {
  fileName: string;
}) {
  const [downloading, setDownloading] =
    useState(false);

  async function handleDownload() {
    if (downloading) return;

    setDownloading(true);

    try {
      const element =
        document.getElementById("quotation-pdf");

      if (!element) {
        throw new Error(
          "Quotation document not found."
        );
      }

      const canvas = await html2canvas(
        element,
        {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        }
      );

      const imageData =
        canvas.toDataURL(
          "image/png",
          1
        );

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;

      const imageWidth =
        pageWidth;

      const imageHeight =
        (canvas.height *
          imageWidth) /
        canvas.width;

      let finalWidth =
        imageWidth;

      let finalHeight =
        imageHeight;

      let x = 0;
      const y = 0;

      if (
        imageHeight >
        pageHeight
      ) {
        const scale =
          pageHeight /
          imageHeight;

        finalWidth =
          imageWidth *
          scale;

        finalHeight =
          pageHeight;

        x =
          (pageWidth -
            finalWidth) /
          2;
      }

      pdf.addImage(
        imageData,
        "PNG",
        x,
        y,
        finalWidth,
        finalHeight,
        undefined,
        "FAST"
      );

      const safeFileName =
        fileName.endsWith(".pdf")
          ? fileName
          : `${fileName}.pdf`;

      pdf.save(safeFileName);
    } catch (error) {
      console.error(
        "PDF download error:",
        error
      );

      alert(
        "Could not generate PDF. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
    >
      {downloading
        ? "Generating PDF..."
        : "Download PDF"}
    </button>
  );
}