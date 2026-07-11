import { jsPDF } from "jspdf";

// Strip markdown syntax for clean PDF text
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/```[\w]*\n?/g, "").replace(/```/g, "");
    })
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_{1,2}(.+?)_{1,2}/g, "$1")
    .replace(/#+\s+/g, "")
    .replace(/>\s+/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")
    .replace(/[-*+]\s+/g, "• ")
    .replace(/\d+\.\s+/g, (m) => m)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Wrap long text into lines that fit within a given width
function wrapText(pdf, text, maxWidth) {
  const lines = [];
  const paragraphs = text.split("\n");
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const wrapped = pdf.splitTextToSize(paragraph, maxWidth);
    lines.push(...wrapped);
  }
  return lines;
}

// Fetch a Cloudinary URL and return base64 string + mimeType
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const [header, base64] = dataUrl.split(",");
        const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
        resolve({ base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Failed to fetch image for PDF:", err);
    return null;
  }
}

// Get image dimensions from base64 to calculate aspect ratio
function getImageDimensions(base64, mimeType) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

export function usePdfExport() {
  const exportChat = async ({ title, model, messages }) => {
    // ── Pre-fetch all images before building PDF ──
    const imageCache = {};

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.file || !msg.file.mimeType?.startsWith("image/")) continue;

      let base64 = msg.file.base64 || null;
      let mimeType = msg.file.mimeType;

      // If no base64 but has Cloudinary URL, fetch it
      if (!base64 && msg.file.previewUrl) {
        const fetched = await fetchImageAsBase64(msg.file.previewUrl);
        if (fetched) {
          base64 = fetched.base64;
          mimeType = fetched.mimeType;
        }
      }

      if (base64) {
        const dims = await getImageDimensions(base64, mimeType);
        imageCache[i] = {
          base64,
          mimeType,
          width: dims.width,
          height: dims.height,
        };
      }
    }

    // ── Setup PDF ──
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginLeft = 18;
    const marginRight = 18;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const maxImageHeight = pageHeight * 0.45; // cap at ~half page height

    const colors = {
      bg: [7, 9, 15],
      accent: [49, 184, 198],
      textPrimary: [255, 255, 255],
      textMuted: [100, 110, 130],
      userBubble: [30, 34, 48],
      aiBubble: [14, 17, 23],
      divider: [30, 36, 55],
    };

    let y = 0;

    const fillBackground = () => {
      pdf.setFillColor(...colors.bg);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
    };

    const addPage = () => {
      pdf.addPage();
      fillBackground();
      y = 14;
    };

    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > pageHeight - 14) {
        addPage();
      }
    };

    // ── Page 1 background ──
    fillBackground();

    // ── HEADER ──
    pdf.setFillColor(...colors.accent);
    pdf.rect(0, 0, pageWidth, 1.2, "F");

    y = 14;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(...colors.accent);
    pdf.text("Cognivra", marginLeft, y);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...colors.textMuted);
    pdf.text("Chat Export", pageWidth - marginRight, y, { align: "right" });

    y += 10;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(...colors.textPrimary);
    const titleLines = pdf.splitTextToSize(
      title || "Untitled Chat",
      contentWidth,
    );
    pdf.text(titleLines, marginLeft, y);
    y += titleLines.length * 7 + 2;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...colors.textMuted);

    const modelLabel = model
      ? model.charAt(0).toUpperCase() + model.slice(1)
      : "Unknown";
    const exportDate = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    pdf.text(`Model: ${modelLabel}`, marginLeft, y);
    pdf.text(`Exported: ${exportDate}`, pageWidth - marginRight, y, {
      align: "right",
    });

    y += 5;

    pdf.setDrawColor(...colors.divider);
    pdf.setLineWidth(0.4);
    pdf.line(marginLeft, y, pageWidth - marginRight, y);

    y += 8;

    // ── MESSAGES ──
    const validMessages = messages.filter((m) => m.content && m.content.trim());
    const originalIndexMap = validMessages.map((vm) => messages.indexOf(vm));

    for (let i = 0; i < validMessages.length; i++) {
      const message = validMessages[i];
      const originalIndex = originalIndexMap[i];
      const isUser = message.role === "user";
      const rawText = stripMarkdown(message.content);
      const lines = wrapText(pdf, rawText, contentWidth - 12);

      const lineHeight = 5;
      const bubblePadding = 5;

      const cachedImage = imageCache[originalIndex] || null;
      const isPdf = message.file?.mimeType === "application/pdf";

      // Calculate image render dimensions
      let imgRenderWidth = 0;
      let imgRenderHeight = 0;
      if (cachedImage) {
        const aspectRatio = cachedImage.height / cachedImage.width;
        imgRenderWidth = contentWidth - 10;
        imgRenderHeight = imgRenderWidth * aspectRatio;
        if (imgRenderHeight > maxImageHeight) {
          imgRenderHeight = maxImageHeight;
          imgRenderWidth = imgRenderHeight / aspectRatio;
        }
      }

      const pdfIndicatorHeight = isPdf ? 8 : 0;
      const imageBlockHeight = cachedImage ? imgRenderHeight + 6 : 0; // image + label
      const textBlockHeight = lines.length * lineHeight;
      const bubbleContentHeight =
        imageBlockHeight + pdfIndicatorHeight + textBlockHeight;
      const bubbleHeight = bubblePadding * 2 + bubbleContentHeight;

      checkPageBreak(5 + bubbleHeight + 6); // label + bubble + gap

      const bubbleX = isUser ? marginLeft + 20 : marginLeft;
      const bubbleWidth = contentWidth - (isUser ? 20 : 0);
      const textX = bubbleX + bubblePadding + (isUser ? 0 : 2);

      // ── LABEL ──
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      if (isUser) {
        pdf.setTextColor(...colors.accent);
        pdf.text("YOU", pageWidth - marginRight, y, { align: "right" });
      } else {
        pdf.setTextColor(...colors.textMuted);
        pdf.text("COGNIVRA", marginLeft, y);
      }
      y += 4;

      // ── BUBBLE ──
      pdf.setFillColor(...(isUser ? colors.userBubble : colors.aiBubble));
      pdf.roundedRect(bubbleX, y, bubbleWidth, bubbleHeight, 3, 3, "F");
      if (!isUser) {
        pdf.setFillColor(...colors.accent);
        pdf.rect(bubbleX, y, 1.5, bubbleHeight, "F");
      }

      let contentY = y + bubblePadding;

      // ── IMAGE EMBED ──
      if (cachedImage) {
        // Filename label above image
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(7);
        pdf.setTextColor(...colors.textMuted);
        pdf.text(`${message.file.name || "image"}`, textX, contentY);
        contentY += 5;

        // Center image in bubble
        const imgX = bubbleX + (bubbleWidth - imgRenderWidth) / 2;

        try {
          const format = cachedImage.mimeType.includes("png") ? "PNG" : "JPEG";
          pdf.addImage(
            cachedImage.base64,
            format,
            imgX,
            contentY,
            imgRenderWidth,
            imgRenderHeight,
          );
        } catch (err) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(8);
          pdf.setTextColor(...colors.textMuted);
          pdf.text("[Image could not be embedded]", textX, contentY + 4);
        }

        contentY += imgRenderHeight + 4;
      }

      // ── PDF ATTACHMENT INDICATOR ──
      if (isPdf) {
        pdf.setFillColor(20, 24, 36);
        pdf.roundedRect(
          textX,
          contentY,
          bubbleWidth - bubblePadding * 2 - (isUser ? 0 : 2),
          6,
          1.5,
          1.5,
          "F",
        );
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...colors.textMuted);
        pdf.text(
          `${message.file.name || "document.pdf"}  —  PDF attachment (open separately)`,
          textX + 2,
          contentY + 4,
        );
        contentY += pdfIndicatorHeight;
      }

      // ── MESSAGE TEXT ──
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...colors.textPrimary);

      for (let li = 0; li < lines.length; li++) {
        // Mid-message page break
        if (contentY + lineHeight > pageHeight - 14) {
          addPage();
          const remainingLines = lines.slice(li);
          const newBubbleH =
            bubblePadding * 2 + remainingLines.length * lineHeight;
          pdf.setFillColor(...(isUser ? colors.userBubble : colors.aiBubble));
          pdf.roundedRect(bubbleX, y, bubbleWidth, newBubbleH, 3, 3, "F");
          if (!isUser) {
            pdf.setFillColor(...colors.accent);
            pdf.rect(bubbleX, y, 1.5, newBubbleH, "F");
          }
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9.5);
          pdf.setTextColor(...colors.textPrimary);
          for (let rli = 0; rli < remainingLines.length; rli++) {
            pdf.text(
              remainingLines[rli],
              textX,
              y + bubblePadding + rli * lineHeight,
            );
          }
          y += newBubbleH + 6;
          contentY = pageHeight; // exit outer loop cleanly
          break;
        }

        pdf.text(lines[li], textX, contentY);
        contentY += lineHeight;
      }

      // Only advance y if we didn't already do a page break
      if (contentY < pageHeight) {
        y += bubbleHeight + 6;
      }
    }

    // ── FOOTER on every page ──
    const totalPages = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFillColor(...colors.accent);
      pdf.rect(0, pageHeight - 1, pageWidth, 1, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...colors.textMuted);
      pdf.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 4, {
        align: "center",
      });
    }

    // ── SAVE ──
    const safeTitle = (title || "chat")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
      .slice(0, 40);
    pdf.save(`cognivra_${safeTitle}.pdf`);
  };

  return { exportChat };
}
