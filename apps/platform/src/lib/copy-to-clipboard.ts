export const copyToClipboard = async (value: string): Promise<boolean> => {
  const text = value.trim();
  if (!text) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyToClipboardFallback(text);
  }
};

const copyToClipboardFallback = (text: string): boolean => {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const selection = document.getSelection();
  const savedRanges =
    selection && selection.rangeCount > 0
      ? Array.from({ length: selection.rangeCount }, (_, index) =>
          selection.getRangeAt(index).cloneRange(),
        )
      : [];

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);

    if (selection) {
      selection.removeAllRanges();
      for (const range of savedRanges) {
        selection.addRange(range);
      }
    }

    activeElement?.focus();
  }

  return copied;
};
