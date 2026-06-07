/* ============================================================
   Day Progress
   Pure HTML/CSS/JS. No frameworks, no libraries.
   ============================================================ */

/* ---------- DOM references ---------- */
const percentEl = document.getElementById("percent");
const countdownEl = document.getElementById("countdown");
const barEl = document.getElementById("bar");
const barFillEl = document.getElementById("barFill");
const starfieldEl = document.getElementById("starfield");
const gearBtn = document.getElementById("gearBtn");
const menuEl = document.getElementById("menu");
const uploadItem = document.getElementById("uploadItem");
const folderItem = document.getElementById("folderItem");
const removeItem = document.getElementById("removeItem");

/* ============================================================
   Live time / countdown + single pill bar
   ============================================================ */
function pluralize(value, unit) {
	return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function formatRailwayTime(date) {
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

function updateTime() {
	const now = new Date();

	const startOfDay = new Date(now);
	startOfDay.setHours(0, 0, 0, 0);

	const endOfDay = new Date(startOfDay);
	endOfDay.setDate(endOfDay.getDate() + 1);

	const dayMs = endOfDay - startOfDay; // handles DST
	const elapsedMs = now - startOfDay;
	const remainingMs = endOfDay - now;

	// Show the current time in 24-hour railway format.
	percentEl.textContent = formatRailwayTime(now);

	// Countdown subtitle.
	const totalSeconds = Math.floor(remainingMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	countdownEl.textContent =
		`${pluralize(hours, "hour")}, ${pluralize(minutes, "minute")}, ` +
		`and ${pluralize(seconds, "second")} left today`;

	// Bar: fills from left = elapsed % of the day.
	const elapsedPercent = (elapsedMs / dayMs) * 100;
	barFillEl.style.width = `${elapsedPercent}%`;
	barEl.setAttribute("aria-valuenow", elapsedPercent.toFixed(1));
}

updateTime();
setInterval(updateTime, 1000);

/* ============================================================
   Starfield
   ============================================================ */
function renderStarfield() {
	starfieldEl.style.display = "block";
	starfieldEl.innerHTML = "";

	const STAR_COUNT = 80;
	for (let i = 0; i < STAR_COUNT; i++) {
		const star = document.createElement("div");
		const roll = Math.random();

		if (roll < 0.2) {
			star.className = "star big-star";
		} else if (roll < 0.6) {
			star.className = "star regular";
		} else {
			star.className = "star small-star";
		}

		star.style.top = `${Math.random() * 100}%`;
		star.style.left = `${Math.random() * 100}%`;
		starfieldEl.appendChild(star);
	}
}

/* ============================================================
   IndexedDB helpers
   ============================================================ */
const DB_NAME = "DayProgressDB";
const STORE_NAME = "settings";

function openDB() {
	return new Promise((resolve, reject) => {
		try {
			const request = indexedDB.open(DB_NAME, 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME);
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		} catch (err) {
			reject(err);
		}
	});
}

async function getSetting(key) {
	try {
		const db = await openDB();
		return await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			const req = tx.objectStore(STORE_NAME).get(key);
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => reject(req.error);
		});
	} catch (err) {
		console.error("getSetting failed", err);
		return null;
	}
}

async function setSetting(key, value) {
	try {
		const db = await openDB();
		return await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			tx.objectStore(STORE_NAME).put(value, key);
			tx.oncomplete = () => resolve(true);
			tx.onerror = () => reject(tx.error);
		});
	} catch (err) {
		console.error("setSetting failed", err);
		return false;
	}
}

async function deleteSetting(key) {
	try {
		const db = await openDB();
		return await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			tx.objectStore(STORE_NAME).delete(key);
			tx.oncomplete = () => resolve(true);
			tx.onerror = () => reject(tx.error);
		});
	} catch (err) {
		console.error("deleteSetting failed", err);
		return false;
	}
}

/* ============================================================
   Color helpers
   ============================================================ */
function rgbToHsl(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
	s /= 100;
	l /= 100;
	const k = (n) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n) =>
		l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const toHex = (x) =>
		Math.round(x * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/* ============================================================
   Automatic clarity: analyze the image and tune the wallpaper
   filters + scrim + accent + text shadow so the time and the
   pill bar always stay highly legible.
   ============================================================ */
function clamp(v, lo, hi) {
	return Math.max(lo, Math.min(hi, v));
}

function applyAutoClarity(imageUrl) {
	const img = new Image();
	img.crossOrigin = "anonymous";

	img.onload = () => {
		try {
			const size = 60;
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0, size, size);
			const { data } = ctx.getImageData(0, 0, size, size);

			let lumSum = 0;
			let lumSqSum = 0;
			let maxSaturation = 0;
			let dominantHue = 0;
			let dominantSaturation = -1;
			const pixelCount = size * size;

			for (let i = 0; i < data.length; i += 4) {
				const r = data[i];
				const g = data[i + 1];
				const b = data[i + 2];
				const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // 0..1
				lumSum += lum;
				lumSqSum += lum * lum;

				const [h, s] = rgbToHsl(r, g, b);
				if (s > maxSaturation) maxSaturation = s;
				if (s > dominantSaturation) {
					dominantSaturation = s;
					dominantHue = h;
				}
			}

			const meanLum = lumSum / pixelCount; // 0..1
			const variance = lumSqSum / pixelCount - meanLum * meanLum;
			const stdDev = Math.sqrt(Math.max(0, variance)); // busyness proxy
			const isLight = meanLum > 0.5;
			const isGrey = maxSaturation < 18;

			const root = document.documentElement;

			/* --- Image filters ---
         Pull very bright or very dark images toward mid-tones, and
         gently reduce contrast/saturation on busy images so text and
         the bar read cleanly on top. */
			let brightness = 1;
			if (meanLum > 0.62)
				brightness = clamp(1 - (meanLum - 0.62) * 0.9, 0.6, 1);
			else if (meanLum < 0.32)
				brightness = clamp(1 + (0.32 - meanLum) * 0.5, 1, 1.2);

			const contrast = clamp(1 - stdDev * 0.45, 0.82, 1);
			const saturate = clamp(1 - stdDev * 0.35, 0.85, 1);

			root.style.setProperty("--img-brightness", brightness.toFixed(3));
			root.style.setProperty("--img-contrast", contrast.toFixed(3));
			root.style.setProperty("--img-saturate", saturate.toFixed(3));

			/* --- Text + scrim ---
         White text on a dark scrim for light images, and a light scrim
         for dark images. Scrim strength scales with how "busy" the
         image is so detail-heavy photos get more separation. */
			const busyBoost = clamp(stdDev * 0.6, 0, 0.25);
			if (isLight) {
				root.style.setProperty("--text", "#ffffff");
				root.style.setProperty("--subtle", "#f0f0f0");
				root.style.setProperty(
					"--scrim",
					`rgba(0,0,0,${(0.3 + busyBoost).toFixed(2)})`,
				);
				root.style.setProperty(
					"--text-shadow",
					"0 1px 8px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.5)",
				);
			} else {
				root.style.setProperty("--text", "#ffffff");
				root.style.setProperty("--subtle", "#e5e7eb");
				root.style.setProperty(
					"--scrim",
					`rgba(0,0,0,${(0.22 + busyBoost).toFixed(2)})`,
				);
				root.style.setProperty(
					"--text-shadow",
					"0 1px 10px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.6)",
				);
			}

			/* --- Accent fill for the bar --- */
			let fill;
			if (isGrey) {
				fill = "#34d399";
			} else {
				// Bright, vivid accent that reads on the darkened backdrop.
				fill = hslToHex(dominantHue, 75, 60);
			}
			root.style.setProperty("--fill", fill);
			root.style.setProperty("--track", "rgba(255,255,255,0.22)");
		} catch (err) {
			console.error("Auto clarity failed", err);
		}
	};

	img.src = imageUrl;
}

/* ============================================================
   Apply a wallpaper image URL to the page
   ============================================================ */
// setWallpaper() and clearWallpaperUI() removed — storage and display are
// handled by the new wallpaper system. These functions were unused.

/* ============================================================
   Wallpaper loader (folder handle OR uploaded image blob)
   ============================================================ */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

function isImageFile(name) {
	const lower = name.toLowerCase();
	return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
/* ============================================================
   New wallpaper system
   - Stores resized dataUrls in `wallpapers` setting
   - Tracks next index in `wallpaperCursor`
   - Optionally stores `folderHandle` (Chrome/Edge)
   ============================================================ */

// Small wrapper in case older code expects this name.
function extractAndApplyColors(imageUrl) {
	try {
		applyAutoClarity(imageUrl);
	} catch (err) {
		console.error("extractAndApplyColors failed", err);
	}
}

async function resizeImage(file) {
	try {
		if (!file || !file.type || !file.type.startsWith("image/")) return null;

		const img = await new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const i = new Image();
			i.onload = () => {
				URL.revokeObjectURL(url);
				resolve(i);
			};
			i.onerror = (e) => {
				URL.revokeObjectURL(url);
				reject(e);
			};
			i.src = url;
		});

		const canvas = document.createElement("canvas");
		let { width, height } = img;
		if (width > 1920) {
			const ratio = 1920 / width;
			width = 1920;
			height = Math.round(height * ratio);
		}
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(img, 0, 0, width, height);
		const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
		return dataUrl;
	} catch (err) {
		console.error("resizeImage failed for file", file && file.name, err);
		return null;
	}
}

function showProgress(text) {
	let el = document.getElementById("progress-toast");
	if (!el) {
		el = document.createElement("div");
		el.id = "progress-toast";
		el.style.position = "fixed";
		el.style.bottom = "60px";
		el.style.left = "50%";
		el.style.transform = "translateX(-50%)";
		el.style.background = "rgba(20,20,22,0.95)";
		el.style.color = "#fff";
		el.style.padding = "8px 16px";
		el.style.borderRadius = "20px";
		el.style.fontSize = "0.85rem";
		el.style.zIndex = "9999";
		document.body.appendChild(el);
	}
	el.textContent = text;
}

function hideProgress() {
	const el = document.getElementById("progress-toast");
	if (el) el.remove();
}

async function addWallpapers(files) {
	try {
		if (!files || !files.length) return;
		if (files.length > 500) {
			const ok = confirm(
				`You're adding ${files.length} images. This may take a moment. Continue?`,
			);
			if (!ok) return;
		}

		showProgress(`Saving ${files.length} images...`);

		const images = [];
		let saved = 0;
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (!file || !file.type || !file.type.startsWith("image/")) continue;
			const dataUrl = await resizeImage(file);
			if (!dataUrl) continue;
			const obj = { id: Date.now() + Math.random(), dataUrl, name: file.name };
			images.push(obj);
			saved++;
			showProgress(`Saving ${saved} / ${files.length}...`);
		}

		// Store each wallpaper individually to avoid single large value quota issues.
		const index = (await getSetting("wallpapers:index")) || [];
		for (const img of images) {
			await setSetting(`wallpaper:${img.id}`, img.dataUrl);
			index.push({ id: img.id, name: img.name });
		}
		await setSetting("wallpapers:index", index);
		await setSetting("wallpaperCursor", 0);
		hideProgress();
		location.reload();
	} catch (err) {
		console.error("addWallpapers failed", err);
		hideProgress();
	}
}

async function loadWallpaper() {
	try {
		const idx = (await getSetting("wallpapers:index")) || [];
		if (!idx || idx.length === 0) {
			renderStarfield();
			return;
		}

		const cursor = (await getSetting("wallpaperCursor")) ?? 0;
		const i = ((cursor % idx.length) + idx.length) % idx.length;
		const entry = idx[i];
		const dataUrl = await getSetting(`wallpaper:${entry.id}`);
		if (!dataUrl) {
			renderStarfield();
			return;
		}

		document.body.style.backgroundImage = `url("${dataUrl}")`;
		document.body.style.backgroundSize = "cover";
		document.body.style.backgroundPosition = "center";
		starfieldEl.style.display = "none";
		// Run extractor to compute text/fill colors (async). After extractor
		// completes we override the image filter vars so the wallpaper stays
		// vivid while keeping extractor-chosen `--text` and `--fill`.
		extractAndApplyColors(dataUrl);
		setTimeout(() => {
			try {
				const root = document.documentElement;
				root.style.setProperty("--img-brightness", "1");
				root.style.setProperty("--img-contrast", "1");
				root.style.setProperty("--img-saturate", "1");
				root.style.setProperty("--scrim", "rgba(0,0,0,0.25)");
			} catch (e) {
				// ignore
			}
		}, 300);
		await setSetting("wallpaperCursor", (i + 1) % idx.length);
	} catch (err) {
		console.error("loadWallpaper failed", err);
		renderStarfield();
	}
}

async function removeWallpaper() {
	try {
		const ok = confirm("Remove all wallpapers?");
		if (!ok) return;
		// Delete individual wallpaper entries and the index
		const idx = (await getSetting("wallpapers:index")) || [];
		for (const entry of idx) {
			try {
				await deleteSetting(`wallpaper:${entry.id}`);
			} catch (err) {
				console.error("failed to delete wallpaper key", entry.id, err);
			}
		}
		await deleteSetting("wallpapers:index");
		await deleteSetting("wallpaperCursor");
		await deleteSetting("folderHandle");
		location.reload();
	} catch (err) {
		console.error("removeWallpaper failed", err);
	}
}

/* ============================================================
   Settings menu + actions
   ============================================================ */
const supportsFolderPicker = typeof window.showDirectoryPicker === "function";

if (!supportsFolderPicker) {
	// Hide the folder item when the File System Access API isn't available
	try {
		folderItem.style.display = "none";
	} catch (e) {
		// ignore
	}
}

function openMenu() {
	menuEl.hidden = false;
	gearBtn.setAttribute("aria-expanded", "true");
	refreshRemoveItemState();
}

function closeMenu() {
	menuEl.hidden = true;
	gearBtn.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
	if (menuEl.hidden) openMenu();
	else closeMenu();
}

async function refreshRemoveItemState() {
	try {
		const idx = (await getSetting("wallpapers:index")) || [];
		const has = idx && idx.length > 0;
		removeItem.disabled = !has;
		if (!has) {
			removeItem.style.opacity = "0.4";
			removeItem.style.pointerEvents = "none";
		} else {
			removeItem.style.opacity = "1";
			removeItem.style.pointerEvents = "auto";
		}
	} catch (err) {
		console.error("refreshRemoveItemState failed", err);
		removeItem.disabled = true;
	}
}

/* Upload images path */
uploadItem.addEventListener("click", () => {
	closeMenu();
	const inp = document.getElementById("wallpaper-input");
	if (inp) inp.click();
});

document
	.getElementById("wallpaper-input")
	.addEventListener("change", async (e) => {
		const files = Array.from(e.target.files || []);
		e.target.value = "";
		await addWallpapers(files);
	});

/* Folder picker: Chrome/Edge uses showDirectoryPicker, otherwise fallback to webkitdirectory input */
async function chooseFolderPicker() {
	try {
		const handle = await window.showDirectoryPicker({ mode: "read" });
		if (!handle) return;
		await setSetting("folderHandle", handle);

		// Collect image files from handle
		const files = [];
		for await (const entry of handle.values()) {
			if (entry.kind === "file" && isImageFile(entry.name)) {
				try {
					const f = await entry.getFile();
					files.push(f);
				} catch (err) {
					console.error("failed to get file from entry", err);
				}
			}
		}

		if (files.length === 0) {
			// silently clear stored handle if empty
			await deleteSetting("folderHandle");
			return;
		}

		files.sort((a, b) => a.name.localeCompare(b.name));
		await addWallpapers(files);
	} catch (err) {
		if (err && err.name === "AbortError") return;
		console.error("chooseFolderPicker failed", err);
	}
}

if (supportsFolderPicker) {
	folderItem.addEventListener("click", () => {
		closeMenu();
		chooseFolderPicker();
	});
} else {
	// Fallback to webkitdirectory input
	folderItem.addEventListener("click", () => {
		closeMenu();
		const inp = document.getElementById("folder-input");
		if (inp) inp.click();
	});
	document
		.getElementById("folder-input")
		.addEventListener("change", async (e) => {
			const files = Array.from(e.target.files || []).filter(
				(f) => f && f.type && f.type.startsWith("image/"),
			);
			e.target.value = "";
			await addWallpapers(files);
		});
}

/* Remove the current wallpaper (long-press or menu) */
removeItem.addEventListener("click", async () => {
	closeMenu();
	await removeWallpaper();
});

/* Gear interactions: click opens menu, long-press (500ms) or right-click triggers remove confirm */
let gearPressTimer = null;
gearBtn.addEventListener("mousedown", (e) => {
	// start long-press timer
	gearPressTimer = setTimeout(async () => {
		gearPressTimer = null;
		await removeWallpaper();
	}, 500);
});
gearBtn.addEventListener("mouseup", (e) => {
	if (gearPressTimer) {
		clearTimeout(gearPressTimer);
		gearPressTimer = null;
		// treat as click
		toggleMenu();
		// refresh removeItem state when opening
		if (!menuEl.hidden) refreshRemoveItemState();
	}
});
gearBtn.addEventListener("mouseleave", () => {
	if (gearPressTimer) {
		clearTimeout(gearPressTimer);
		gearPressTimer = null;
	}
});
gearBtn.addEventListener("contextmenu", async (e) => {
	e.preventDefault();
	await removeWallpaper();
});

/* Click outside / Escape closes the menu. */
document.addEventListener("click", (e) => {
	if (!menuEl.hidden && !menuEl.contains(e.target) && e.target !== gearBtn) {
		closeMenu();
	}
});

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") closeMenu();
});

/* ============================================================
   Init
   ============================================================ */
loadWallpaper();
