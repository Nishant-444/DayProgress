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
const scrimEl = document.getElementById("scrim");
const gearBtn = document.getElementById("gearBtn");
const menuEl = document.getElementById("menu");
const uploadItem = document.getElementById("uploadItem");
const folderItem = document.getElementById("folderItem");
const removeItem = document.getElementById("removeItem");
const fileInput = document.getElementById("fileInput");

/* ============================================================
   Live time / countdown + single pill bar
   ============================================================ */
function pluralize(value, unit) {
	return `${value} ${unit}${value === 1 ? "" : "s"}`;
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

	// Percent left, 1 decimal place.
	const percentLeft = (remainingMs / dayMs) * 100;
	percentEl.textContent = `${percentLeft.toFixed(1)}% left today`;

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
function setWallpaper(imageUrl) {
	starfieldEl.style.display = "none";
	document.body.classList.add("has-wallpaper");
	document.documentElement.style.setProperty(
		"--wallpaper",
		`url("${imageUrl}")`,
	);
	applyAutoClarity(imageUrl);
	updateRemoveItem(true);
}

function clearWallpaperUI() {
	document.body.classList.remove("has-wallpaper");
	document.documentElement.style.removeProperty("--wallpaper");
	const root = document.documentElement;
	root.style.setProperty("--text", "#f4f4f5");
	root.style.setProperty("--subtle", "#a1a1aa");
	root.style.setProperty("--fill", "#34d399");
	root.style.setProperty("--track", "rgba(255,255,255,0.14)");
	root.style.setProperty("--scrim", "rgba(0,0,0,0)");
	root.style.setProperty("--text-shadow", "none");
	root.style.setProperty("--img-brightness", "1");
	root.style.setProperty("--img-contrast", "1");
	root.style.setProperty("--img-saturate", "1");
	renderStarfield();
	updateRemoveItem(false);
}

/* ============================================================
   Wallpaper loader (folder handle OR uploaded image blob)
   ============================================================ */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

function isImageFile(name) {
	const lower = name.toLowerCase();
	return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function loadFromFolder(folderHandle) {
	const permission = await folderHandle.requestPermission({ mode: "read" });
	if (permission !== "granted") {
		await deleteSetting("folderHandle");
		return false;
	}

	const imageFiles = [];
	for await (const entry of folderHandle.values()) {
		if (entry.kind === "file" && isImageFile(entry.name)) {
			imageFiles.push(entry);
		}
	}

	if (imageFiles.length === 0) {
		alert("No images found in this folder");
		await deleteSetting("folderHandle");
		return false;
	}

	imageFiles.sort((a, b) => a.name.localeCompare(b.name));

	const cursor = (await getSetting("wallpaperCursor")) ?? 0;
	const index = cursor % imageFiles.length;

	const file = await imageFiles[index].getFile();
	const imageUrl = URL.createObjectURL(file);
	setWallpaper(imageUrl);

	await setSetting("wallpaperCursor", (cursor + 1) % imageFiles.length);
	return true;
}

async function loadWallpaper() {
	try {
		// A folder handle takes priority (rotates each load).
		const folderHandle = await getSetting("folderHandle");
		if (folderHandle && supportsFolderPicker) {
			const ok = await loadFromFolder(folderHandle);
			if (ok) return;
		}

		// Otherwise fall back to a stored single uploaded image.
		const blob = await getSetting("imageBlob");
		if (blob) {
			const imageUrl = URL.createObjectURL(blob);
			setWallpaper(imageUrl);
			return;
		}

		clearWallpaperUI();
	} catch (err) {
		console.error("loadWallpaper failed", err);
		clearWallpaperUI();
	}
}

/* ============================================================
   Settings menu + actions
   ============================================================ */
const supportsFolderPicker = typeof window.showDirectoryPicker === "function";

function openMenu() {
	menuEl.hidden = false;
	gearBtn.setAttribute("aria-expanded", "true");
}

function closeMenu() {
	menuEl.hidden = true;
	gearBtn.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
	if (menuEl.hidden) openMenu();
	else closeMenu();
}

async function updateRemoveItem(hasWallpaper) {
	removeItem.disabled = !hasWallpaper;
}

/* Upload a single image file (works in all browsers). */
uploadItem.addEventListener("click", () => {
	closeMenu();
	fileInput.click();
});

fileInput.addEventListener("change", async () => {
	const file = fileInput.files && fileInput.files[0];
	fileInput.value = ""; // allow re-selecting the same file later
	if (!file) return;

	// Switching to an uploaded image: drop any stored folder.
	await deleteSetting("folderHandle");
	await deleteSetting("wallpaperCursor");
	await setSetting("imageBlob", file);

	const imageUrl = URL.createObjectURL(file);
	setWallpaper(imageUrl);
});

/* Choose a folder (Chromium only). */
async function chooseFolder() {
	try {
		const handle = await window.showDirectoryPicker({ mode: "read" });
		await deleteSetting("imageBlob");
		await setSetting("folderHandle", handle);
		await setSetting("wallpaperCursor", 0);
		closeMenu();
		location.reload();
	} catch (err) {
		// User cancelled the picker — do nothing.
	}
}

if (supportsFolderPicker) {
	folderItem.addEventListener("click", chooseFolder);
} else {
	folderItem.disabled = true;
	folderItem.textContent = "Choose folder (Chromium only)";
}

/* Remove the current wallpaper. */
removeItem.addEventListener("click", async () => {
	await deleteSetting("folderHandle");
	await deleteSetting("wallpaperCursor");
	await deleteSetting("imageBlob");
	closeMenu();
	clearWallpaperUI();
});

/* Gear toggles the menu. */
gearBtn.addEventListener("click", (e) => {
	e.stopPropagation();
	toggleMenu();
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
