const grid = document.getElementById("arrayGrid");
const lengthInput = document.getElementById("arrayLength");
const lengthFeedback = document.getElementById("lengthFeedback");
const clearAllButton = document.getElementById("clearAllButton");
const presentButton = document.getElementById("presentButton");
const presentationOverlay = document.getElementById("presentationOverlay");
const presentationGrid = document.getElementById("presentationGrid");
const exitPresentationButton = document.getElementById("exitPresentationButton");
const shuffleButton = document.getElementById("shuffleButton");
const devicePicker = document.getElementById("devicePicker");
const actionDialog = document.getElementById("actionDialog");
const searchDialog = document.getElementById("searchDialog");
const fromDeviceButton = document.getElementById("fromDeviceButton");
const searchButton = document.getElementById("searchButton");
const mediaUrl = document.getElementById("mediaUrl");
const applyUrlButton = document.getElementById("applyUrlButton");
const urlPreview = document.getElementById("urlPreview");
const previewImage = document.getElementById("previewImage");
const slotTemplate = document.getElementById("slotTemplate");

let slots = [];
let activeSlotIndex = null;
let presentationMode = false;
let highlightedSlotIndex = null;
const MAX_SLOTS = 20;
const MIN_SLOTS = 1;

function closeDialogIfOpen(dialog) {
  if (dialog?.open) {
    dialog.close();
  }
}

function createEmptySlots(length) {
  const nextSlots = Array.from({ length }, (_, index) => slots[index] ?? null);
  slots = nextSlots;
}

function getPresentationColumns(count) {
  if (count <= 1) {
    return 1;
  }

  const viewportWidth = window.innerWidth - 80;
  const viewportHeight = window.innerHeight - 170;
  let best = {
    columns: count,
    score: Number.POSITIVE_INFINITY,
  };

  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const cardWidth = (viewportWidth - (columns - 1) * 14) / columns;
    const cardHeight = (viewportHeight - (rows - 1) * 14) / rows;

    if (cardWidth < 110 || cardHeight < 110) {
      continue;
    }

    const emptySlots = rows * columns - count;
    const rowBalancePenalty = Math.abs(columns - rows) * 10;
    const sizePenalty = Math.abs(cardWidth - cardHeight) * 0.15;
    const score = emptySlots * 20 + rowBalancePenalty + sizePenalty;

    if (score < best.score) {
      best = { columns, score };
    }
  }

  return best.columns;
}

function applyPresentationLayout() {
  const count = slots.length || 1;
  const columns = getPresentationColumns(count);
  const rows = Math.ceil(count / columns);
  const gap = window.innerWidth <= 640 ? 10 : 14;
  const sidePadding = window.innerWidth <= 640 ? 32 : 80;
  const topPadding = window.innerWidth <= 640 ? 108 : 170;
  const maxWidth = Math.max(110, Math.floor((window.innerWidth - sidePadding - gap * (columns - 1)) / columns));
  const maxHeight = Math.max(110, Math.floor((window.innerHeight - topPadding - gap * (rows - 1)) / rows));
  const cardSize = Math.max(110, Math.min(maxWidth, maxHeight));

  presentationGrid.style.setProperty("--presentation-card-width", `${cardSize}px`);
  presentationGrid.style.setProperty("--presentation-card-height", `${cardSize}px`);
}

function renderSlots(target, isPresentationView = false) {
  target.innerHTML = "";
  slots.forEach((item, index) => {
    const fragment = slotTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".slot-card");
    const indexLabel = fragment.querySelector(".slot-index");
    const removeButton = fragment.querySelector(".slot-remove");
    const media = fragment.querySelector(".slot-media");
    const placeholder = fragment.querySelector(".slot-placeholder");

    indexLabel.textContent = `Slot ${index + 1}`;
    indexLabel.hidden = isPresentationView;
    card.dataset.index = String(index);

    if (item) {
      media.src = item.src;
      media.alt = item.alt || `Selected media for slot ${index + 1}`;
      media.hidden = false;
      placeholder.hidden = true;
      removeButton.hidden = isPresentationView;
    } else {
      removeButton.hidden = true;
    }

    if (isPresentationView && highlightedSlotIndex === index) {
      card.classList.add("active-halo");
    }

    card.addEventListener("click", (event) => {
      event.stopPropagation();

      if (isPresentationView) {
        setHighlightedSlot(index);
        return;
      }

      openActionDialog(index);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();

        if (isPresentationView) {
          setHighlightedSlot(index);
          return;
        }

        openActionDialog(index);
      }
    });

    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      slots[index] = null;
      render();
    });

    target.appendChild(fragment);
  });
}

function render() {
  renderSlots(grid, false);

  if (presentationMode) {
    applyPresentationLayout();
    renderSlots(presentationGrid, true);
  } else {
    presentationGrid.innerHTML = "";
  }
}

function openActionDialog(index) {
  if (presentationMode) {
    return;
  }

  activeSlotIndex = index;
  actionDialog.showModal();
}

function openSearchDialog() {
  closeDialogIfOpen(actionDialog);
  searchDialog.showModal();
  mediaUrl.focus();
}

function setSlotMedia(index, src, alt = "") {
  if (index === null || index === undefined) {
    return;
  }

  slots[index] = { src, alt };
  render();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

async function useDeviceFile(file, index) {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }

  const src = await readFileAsDataUrl(file);
  setSlotMedia(index, src, file.name);
  closeDialogIfOpen(actionDialog);
}

function isLikelyImageUrl(value) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed);
}

function normalizeLength(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return slots.length || 8;
  }

  if (parsed > MAX_SLOTS) {
    lengthFeedback.textContent = "Maximum array length is 20.";
    return MAX_SLOTS;
  }

  lengthFeedback.textContent = "";
  return Math.max(MIN_SLOTS, Math.floor(parsed));
}

function refreshPreview() {
  const value = mediaUrl.value.trim();
  if (!isLikelyImageUrl(value)) {
    urlPreview.hidden = true;
    previewImage.removeAttribute("src");
    return;
  }

  previewImage.src = value;
  urlPreview.hidden = false;
}

function setHighlightedSlot(index) {
  highlightedSlotIndex = index;
  render();
}

function clearHighlightedSlot() {
  if (highlightedSlotIndex === null) {
    return;
  }

  highlightedSlotIndex = null;
  render();
}

function togglePresentationMode(enabled) {
  presentationMode = enabled;
  document.body.classList.toggle("presentation-mode", enabled);
  presentationOverlay.hidden = !enabled;

  if (!enabled) {
    highlightedSlotIndex = null;
  }

  closeDialogIfOpen(actionDialog);
  closeDialogIfOpen(searchDialog);
  render();
}

function shuffleSlots() {
  const shuffled = [...slots];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  slots = shuffled;
  highlightedSlotIndex = null;
  render();
}

lengthInput.addEventListener("change", () => {
  const nextLength = normalizeLength(lengthInput.value);
  lengthInput.value = String(nextLength);
  createEmptySlots(nextLength);
  render();
});

lengthInput.addEventListener("input", () => {
  if (Number(lengthInput.value) > MAX_SLOTS) {
    lengthFeedback.textContent = "Maximum array length is 20.";
  } else {
    lengthFeedback.textContent = "";
  }
});

clearAllButton.addEventListener("click", () => {
  slots = slots.map(() => null);
  render();
});

presentButton.addEventListener("click", () => {
  togglePresentationMode(true);
});

fromDeviceButton.addEventListener("click", () => {
  devicePicker.click();
});

searchButton.addEventListener("click", () => {
  openSearchDialog();
});

devicePicker.addEventListener("change", async () => {
  const file = devicePicker.files?.[0];
  if (!file) {
    return;
  }

  await useDeviceFile(file, activeSlotIndex);
  devicePicker.value = "";
});

mediaUrl.addEventListener("input", refreshPreview);

applyUrlButton.addEventListener("click", () => {
  const value = mediaUrl.value.trim();
  if (!isLikelyImageUrl(value)) {
    mediaUrl.focus();
    return;
  }

  setSlotMedia(activeSlotIndex, value, "Selected media");
  closeDialogIfOpen(searchDialog);
  mediaUrl.value = "";
  refreshPreview();
});

presentationOverlay.addEventListener("click", () => {
  clearHighlightedSlot();
});

presentationGrid.addEventListener("click", (event) => {
  event.stopPropagation();
});

exitPresentationButton.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePresentationMode(false);
});

shuffleButton.addEventListener("click", (event) => {
  event.stopPropagation();
  shuffleSlots();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && presentationMode) {
    togglePresentationMode(false);
  }
});

window.addEventListener("resize", () => {
  if (presentationMode) {
    render();
  }
});

[actionDialog, searchDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;

    if (!inside) {
      closeDialogIfOpen(dialog);
    }
  });
});

createEmptySlots(Number(lengthInput.value));
render();
