"use strict";

const byId = (id) => document.getElementById(id);
const toast = byId("toast");
let toastTimeout;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 4200);
}

function formatKg(value) {
    return `${value.toFixed(1)} kg`;
}

const mountainInput = byId("mountain");
const mapLink = byId("map-link");
const mapPreview = byId("map-preview");
const trekMap = byId("trek-map");
const mapHint = byId("map-hint");
const tripAltitudeInput = byId("trip-altitude");
let mapUpdateTimeout;

function updateMapLink() {
    const mountain = mountainInput.value.trim();
    window.clearTimeout(mapUpdateTimeout);

    if (!mountain) {
        mapPreview.hidden = true;
        trekMap.removeAttribute("src");
        mapHint.textContent = "Enter a trek or mountain name above to preview it on Google Maps.";
        mapLink.href = "https://maps.google.com/";
        mapLink.textContent = "Open Google Maps ↗";
        return;
    }

    mapPreview.hidden = false;
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mountain)}`;
    mapLink.textContent = `Open Google Maps for ${mountain} ↗`;
    mapHint.textContent = `Google Maps search preview for “${mountain}”. Add a nearby town or region if needed.`;
    mapUpdateTimeout = window.setTimeout(() => {
        trekMap.src = `https://maps.google.com/maps?q=${encodeURIComponent(mountain)}&output=embed`;
        trekMap.title = `Google Maps search for ${mountain}`;
    }, 500);
}

mountainInput.addEventListener("input", updateMapLink);

byId("trip-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const mountain = mountainInput.value.trim();
    const altitude = Number(tripAltitudeInput.value);
    const bodyMass = Number(byId("body-mass").value);
    const packWeight = Number(byId("pack-weight").value);
    const result = byId("pack-result");

    if (!mountain || !Number.isFinite(altitude) || !Number.isFinite(bodyMass) || bodyMass <= 0 ||
        !Number.isFinite(packWeight) || packWeight < 0) {
        result.className = "result-box alert";
        result.textContent = "Enter a mountain, altitude, body mass, and valid backpack weight to check your plan.";
        return;
    }

    const targetWeight = bodyMass * 0.1;
    const packRatio = packWeight / bodyMass;
    const altitudeNote = altitude >= 2500
        ? " At this altitude, allow for acclimatization and check route-specific guidance."
        : "";
    let assessment;

    if (packRatio <= 0.1) {
        result.className = "result-box";
        assessment = `Your ${formatKg(packWeight)} pack is within a general planning target of about 10% of your body mass (${formatKg(targetWeight)}).`;
    } else if (packRatio <= 0.15) {
        result.className = "result-box caution";
        assessment = `Your pack is about ${(packRatio * 100).toFixed(0)}% of your body mass. Consider reducing it toward ${formatKg(targetWeight)} for a more comfortable plan.`;
    } else {
        result.className = "result-box alert";
        assessment = `Your pack is about ${(packRatio * 100).toFixed(0)}% of your body mass, above a general comfort target. Aim to reduce it by about ${formatKg(packWeight - targetWeight)} to reach ${formatKg(targetWeight)}.`;
    }

    result.textContent = `${mountain} at ${altitude.toLocaleString()} m: ${assessment}${altitudeNote} This rough estimate cannot determine what is safe for you; terrain, trip length, fitness, conditions, and experience matter.`;
    updateMapLink();
});

const spo2Input = byId("spo2");
const heartRateInput = byId("heart-rate");
const currentAltitudeInput = byId("current-altitude");
const spo2Value = byId("spo2-value");
const heartRateValue = byId("heart-rate-value");
let lastCoordinates = null;
let locationRequest = null;
let dangerLocationRequested = false;

function updateHealthValues() {
    spo2Value.value = `${spo2Input.value}%`;
    spo2Value.textContent = spo2Value.value;
    heartRateValue.value = `${heartRateInput.value} BPM`;
    heartRateValue.textContent = heartRateValue.value;
}

spo2Input.addEventListener("input", updateHealthValues);
heartRateInput.addEventListener("input", updateHealthValues);

function requestLocation() {
    if (lastCoordinates) return Promise.resolve(true);
    if (locationRequest) return locationRequest;

    const locationStatus = byId("location-status");
    if (!navigator.geolocation) {
        locationStatus.textContent = "Location is unavailable in this browser.";
        return Promise.resolve(false);
    }

    locationStatus.textContent = "Requesting location permission…";
    locationRequest = new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                lastCoordinates = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                locationStatus.textContent = `Lat ${lastCoordinates.latitude.toFixed(4)}, Lon ${lastCoordinates.longitude.toFixed(4)}`;
                locationRequest = null;
                resolve(true);
            },
            (error) => {
                const messages = {
                    1: "Location permission was denied.",
                    2: "Your location could not be determined.",
                    3: "The location request timed out."
                };
                locationStatus.textContent = messages[error.code] || "The location request failed.";
                locationRequest = null;
                resolve(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
    });
    return locationRequest;
}

byId("location-button").addEventListener("click", () => {
    void requestLocation();
});

byId("health-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const spo2 = Number(spo2Input.value);
    const heartRate = Number(heartRateInput.value);
    const altitude = Number(currentAltitudeInput.value);
    const result = byId("health-result");
    const emergencyFlags = [];
    const cautionFlags = [];

    if (spo2 <= 80) emergencyFlags.push(`SpO₂ is ${spo2}%`);
    else if (spo2 <= 90) cautionFlags.push(`SpO₂ is ${spo2}%`);

    if (heartRate >= 150) emergencyFlags.push(`heart rate is ${heartRate} BPM`);
    else if (heartRate >= 120) cautionFlags.push(`heart rate is ${heartRate} BPM`);

    if (emergencyFlags.length) {
        result.className = "result-box health-result alert";
        result.textContent = `Urgent warning flag: ${emergencyFlags.join(" and ")}. Stop exertion and seek immediate qualified help; do not continue ascending. These readings alone cannot diagnose an emergency.`;
        byId("sos-button").classList.add("is-flashing");
        byId("sos-status").textContent = "A reading triggered a possible danger flag. Requesting your location; use SOS to copy a message for someone who can help.";
        if (!dangerLocationRequested) {
            dangerLocationRequested = true;
            void requestLocation();
        }
    } else if (cautionFlags.length) {
        result.className = "result-box health-result caution";
        result.textContent = `Caution: ${cautionFlags.join(" and ")}. Pause, reassess how you feel, and seek qualified advice if concerned. Do not ascend if unwell.`;
        byId("sos-button").classList.remove("is-flashing");
    } else {
        result.className = "result-box health-result";
        result.textContent = "No numeric warning flag from these readings. This does not confirm that you are fit to continue; pay attention to symptoms and local medical guidance.";
        byId("sos-button").classList.remove("is-flashing");
    }

    if (altitude >= 2500) {
        result.textContent += ` You are at ${altitude.toLocaleString()} m; oxygen readings vary with altitude and device accuracy.`;
    }
});

function createSosMessage() {
    const coordinates = lastCoordinates
        ? `Lat ${lastCoordinates.latitude.toFixed(4)}, Lon ${lastCoordinates.longitude.toFixed(4)}`
        : "location unavailable";
    return `EMERGENCY! My oxygen is at ${spo2Input.value}%. My current location is: ${coordinates}. Send help!`;
}

byId("sos-button").addEventListener("click", async () => {
    if (!lastCoordinates) await requestLocation();

    const message = createSosMessage();
    try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            throw new Error("Clipboard access is unavailable. Use a secure browser connection.");
        }
        await navigator.clipboard.writeText(message);
        byId("sos-status").textContent = "SOS message copied. Paste it into your SMS or messaging app to send.";
        showToast("SOS message copied! Paste it into your SMS or WhatsApp app to send.");
    } catch (error) {
        byId("sos-status").textContent = `Could not copy the message. Copy it manually: ${message} ${error.message}`;
    }
});

const waterAltitudeInput = byId("water-altitude");
const waterIntervalText = byId("water-interval");
const waterToggle = byId("water-toggle");
const waterStatus = byId("water-status");
let waterTimer = null;
let waterIntervalMinutes = 45;

function updateWaterInterval() {
    const altitude = Number(waterAltitudeInput.value);
    if (!waterAltitudeInput.value || !Number.isFinite(altitude) || altitude < 0 || altitude > 9000) {
        waterIntervalMinutes = 0;
        waterIntervalText.textContent = "Enter a valid altitude (0–9000 m)";
        if (waterTimer) {
            window.clearInterval(waterTimer);
            waterTimer = null;
            waterToggle.textContent = "Start reminders";
        }
        waterStatus.textContent = "Enter a valid altitude before starting reminders.";
        return false;
    }

    waterIntervalMinutes = altitude >= 4000 ? 20 : altitude >= 2500 ? 30 : 45;
    waterIntervalText.textContent = `Reminder every ${waterIntervalMinutes} minutes`;
    if (waterTimer) {
        window.clearInterval(waterTimer);
        waterTimer = window.setInterval(sendWaterReminder, waterIntervalMinutes * 60 * 1000);
        waterStatus.textContent = `Reminders are on every ${waterIntervalMinutes} minutes while this page stays open.`;
    }
    return true;
}

function sendWaterReminder() {
    const message = "Water break: consider a small drink (~150–250 ml), adjusted to thirst and conditions. Avoid forcing excessive water.";
    showToast(message);
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification("Trailwise water reminder", { body: message });
        } catch (error) {
            waterStatus.textContent = `In-page reminder shown; browser notification failed: ${error.message}`;
        }
    }
}

waterAltitudeInput.addEventListener("input", updateWaterInterval);
waterToggle.addEventListener("click", async () => {
    if (waterTimer) {
        window.clearInterval(waterTimer);
        waterTimer = null;
        waterToggle.textContent = "Start reminders";
        waterStatus.textContent = "Reminders are off.";
        return;
    }

    if (!updateWaterInterval()) return;
    let notificationNote = "";
    if ("Notification" in window && Notification.permission === "default") {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                notificationNote = " Browser notifications are off; in-page reminders will still appear.";
            }
        } catch (error) {
            notificationNote = ` Browser notification permission could not be requested: ${error.message} In-page reminders will still appear.`;
        }
    } else if (!("Notification" in window) || Notification.permission !== "granted") {
        notificationNote = " Browser notifications are unavailable; in-page reminders will still appear.";
    }

    waterTimer = window.setInterval(sendWaterReminder, waterIntervalMinutes * 60 * 1000);
    waterToggle.textContent = "Stop reminders";
    waterStatus.textContent = `Reminders are on every ${waterIntervalMinutes} minutes while this page stays open.${notificationNote}`;
});

byId("water-test").addEventListener("click", sendWaterReminder);

const restAltitudeInput = byId("rest-altitude");
const timerDisplay = byId("timer-display");
const restGuidance = byId("rest-guidance");
const timerToggle = byId("timer-toggle");
let restDurationSeconds = 24 * 60 * 60;
let remainingSeconds = restDurationSeconds;
let restTimer = null;

function plannedRestHours(altitude) {
    if (altitude < 2500) return 12;
    return 24 + Math.floor((altitude - 2500) / 1000) * 24;
}

function renderTimer() {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    timerDisplay.textContent = [hours, minutes, seconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":");
}

function updateRestDuration() {
    const altitude = Number(restAltitudeInput.value);
    if (!restAltitudeInput.value || !Number.isFinite(altitude) || altitude < 0 || altitude > 9000) {
        restDurationSeconds = 0;
        remainingSeconds = 0;
        restGuidance.textContent = "Enter a valid altitude (0–9000 m) to set the rest reminder.";
        renderTimer();
        return false;
    }

    const hours = plannedRestHours(altitude);
    restDurationSeconds = hours * 60 * 60;
    remainingSeconds = restDurationSeconds;
    restGuidance.textContent = `Planning reminder: ${hours} ${hours === 1 ? "hour" : "hours"} at this altitude.`;
    renderTimer();
    return true;
}

function stopRestTimer() {
    window.clearInterval(restTimer);
    restTimer = null;
    timerToggle.textContent = "Start rest timer";
}

restAltitudeInput.addEventListener("input", () => {
    if (restTimer) stopRestTimer();
    updateRestDuration();
});

timerToggle.addEventListener("click", () => {
    if (restTimer) {
        stopRestTimer();
        return;
    }

    if (!restAltitudeInput.value || !Number.isFinite(Number(restAltitudeInput.value))) {
        updateRestDuration();
        return;
    }

    timerToggle.textContent = "Pause rest timer";
    restTimer = window.setInterval(() => {
        remainingSeconds -= 1;
        renderTimer();
        if (remainingSeconds <= 0) {
            stopRestTimer();
            restGuidance.textContent = "Rest reminder complete. Reassess how you feel and follow local and expert guidance before ascending.";
            showToast("Rest reminder complete. Check how you feel before climbing higher.");
        }
    }, 1000);
});

byId("timer-reset").addEventListener("click", () => {
    if (restTimer) stopRestTimer();
    if (!updateRestDuration()) return;
    remainingSeconds = restDurationSeconds;
    renderTimer();
    const hours = restDurationSeconds / 3600;
    restGuidance.textContent = `Planning reminder: ${hours} ${hours === 1 ? "hour" : "hours"} at this altitude.`;
});

updateHealthValues();
updateMapLink();
updateWaterInterval();
updateRestDuration();

const preferenceKey = "trailwise-preferences";
let preferences = { darkMode: false, gear: {} };

try {
    const savedPreferences = localStorage.getItem(preferenceKey);
    if (savedPreferences) {
        const parsedPreferences = JSON.parse(savedPreferences);
        if (parsedPreferences && typeof parsedPreferences === "object") {
            preferences.darkMode = parsedPreferences.darkMode === true;
            if (parsedPreferences.gear && typeof parsedPreferences.gear === "object") {
                preferences.gear = parsedPreferences.gear;
            }
        }
    }
} catch (error) {
    showToast(`Could not load saved theme or checklist: ${error.message}`);
}

function savePreferences() {
    try {
        localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    } catch (error) {
        showToast(`Could not save your theme or checklist: ${error.message}`);
    }
}

const themeToggle = byId("theme-toggle");

function updateTheme() {
    document.body.classList.toggle("dark-mode", preferences.darkMode);
    themeToggle.textContent = preferences.darkMode ? "☀️ Light mode" : "🌙 Dark mode";
    themeToggle.setAttribute("aria-pressed", String(preferences.darkMode));
}

themeToggle.addEventListener("click", () => {
    preferences.darkMode = !preferences.darkMode;
    updateTheme();
    savePreferences();
});

function updateGearProgress() {
    const checks = [...document.querySelectorAll(".gear-check")];
    const packed = checks.filter((check) => check.checked).length;
    byId("gear-progress").value = packed;
    byId("gear-progress-label").textContent = `${packed} of ${checks.length} packed`;
    return checks;
}

for (const check of document.querySelectorAll(".gear-check")) {
    check.checked = preferences.gear[check.dataset.gear] === true;
    check.addEventListener("change", () => {
        preferences.gear[check.dataset.gear] = check.checked;
        updateGearProgress();
        savePreferences();
    });
}

updateTheme();
updateGearProgress();

const trailTips = [
    "Tell someone your route and expected return time before you set off.",
    "Download an offline map before you lose mobile coverage.",
    "Pack a warm layer and rain protection even when the start is sunny.",
    "Turn around if weather, daylight, or how you feel makes continuing unsafe.",
    "Keep a small reserve of food and water for an unexpected delay."
];
let currentTrailTip = 0;

byId("new-tip").addEventListener("click", () => {
    currentTrailTip = (currentTrailTip + 1 + Math.floor(Math.random() * (trailTips.length - 1))) % trailTips.length;
    byId("trail-tip-text").textContent = trailTips[currentTrailTip];
});
