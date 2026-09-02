"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function QuotationPdfDownload({
  quotationId,
  fileName,
  className = "",
  children,
}: {
  quotationId: number;
  fileName: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;

    setDownloading(true);

    try {
      const response = await fetch(
        `/print/quotations/${quotationId}`
      );

      if (!response.ok) {
        throw new Error(
          "Could not load quotation document."
        );
      }

      const html = await response.text();

      const iframe = document.createElement("iframe");

      iframe.style.position = "fixed";
      iframe.style.left = "-99999px";
      iframe.style.top = "0";
      iframe.style.width = "794px";
      iframe.style.height = "1123px";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";

      document.body.appendChild(iframe);

      const iframeDocument = iframe.contentDocument;

      if (!iframeDocument) {
        iframe.remove();

        throw new Error(
          "Could not create PDF document."
        );
      }

      iframeDocument.open();
      iframeDocument.write(html);
      iframeDocument.close();

      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(
          () => resolve(),
          1500
        );

        iframe.onload = () => {
          window.clearTimeout(timeout);
          resolve();
        };
      });

      const quotationElement =
        iframe.contentDocument?.getElementById(
          "quotation-pdf"
        );

      if (!quotationElement) {
        iframe.remove();

        throw new Error(
          "Quotation PDF element not found."
        );
      }

      const images = Array.from(
        quotationElement.querySelectorAll("img")
      );

      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }

              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 300)
      );

      const canvas = await html2canvas(
        quotationElement,
        {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        }
      );

      const imageData = canvas.toDataURL(
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

      const sourceRatio =
        canvas.height / canvas.width;

      let pdfWidth = pageWidth;
      let pdfHeight =
        pageWidth * sourceRatio;

      let x = 0;
      const y = 0;

      if (pdfHeight > pageHeight) {
        const scale =
          pageHeight / pdfHeight;

        pdfWidth = pdfWidth * scale;
        pdfHeight = pageHeight;

        x =
          (pageWidth - pdfWidth) / 2;
      }

      pdf.addImage(
        imageData,
        "PNG",
        x,
        y,
        pdfWidth,
        pdfHeight,
        undefined,
        "FAST"
      );

      const safeFileName =
        fileName.endsWith(".pdf")
          ? fileName
          : `${fileName}.pdf`;

      pdf.save(safeFileName);

      iframe.remove();
    } catch (error) {
      console.error(
        "Direct PDF download error:",
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
      className={className}
    >
      {downloading
        ? "Generating PDF..."
        : children || "Download PDF"}
    </button>
  );
}