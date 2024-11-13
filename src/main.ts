// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Define constants
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Initialize map
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM).addTo(map).bindTooltip("That's you!");

// Initialize points display
let playerPoints = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Points: 0";

// Spawn cache with random point value and interactive buttons
function spawnCache(i: number, j: number) {
  const lat1 = OAKES_CLASSROOM.lat + i * TILE_DEGREES;
  const lng1 = OAKES_CLASSROOM.lng + j * TILE_DEGREES;
  const lat2 = OAKES_CLASSROOM.lat + (i + 1) * TILE_DEGREES;
  const lng2 = OAKES_CLASSROOM.lng + (j + 1) * TILE_DEGREES;
  const bounds = leaflet.latLngBounds([[lat1, lng1], [lat2, lng2]]);

  const rect = leaflet.rectangle(bounds)
    .addTo(map)
    .bindPopup(() => {
      let pointValue = Math.floor(luck(`${i},${j},initialValue`) * 100);
      const popupDiv = document.createElement("div");

      popupDiv.innerHTML = `
        <div>Cache found at "${i},${j}". Value: <span id="value">${pointValue}</span></div>
        <button id="collect">Collect</button>
        <button id="deposit">Deposit</button>`;
      
      const collectButton = popupDiv.querySelector<HTMLButtonElement>("#collect")!;
      const depositButton = popupDiv.querySelector<HTMLButtonElement>("#deposit")!;
      const valueSpan = popupDiv.querySelector<HTMLSpanElement>("#value")!;

      collectButton.addEventListener("click", () => {
        if (pointValue > 0) {
          pointValue--;
          playerPoints++;
          valueSpan.innerHTML = pointValue.toString();
          statusPanel.innerHTML = `Points: ${playerPoints}`;
        }
      });

      depositButton.addEventListener("click", () => {
        if (playerPoints > 0) { 
          pointValue++;
          playerPoints--;
          valueSpan.innerHTML = pointValue.toString();
          statusPanel.innerHTML = `Points: ${playerPoints}`;
        }
      });

      return popupDiv;
    });
}

// Generate caches in neighborhood grid
Array.from({ length: NEIGHBORHOOD_SIZE * 2 }, (_, offset) => offset - NEIGHBORHOOD_SIZE)
  .forEach(i => Array.from({ length: NEIGHBORHOOD_SIZE * 2 }, (_, offset) => offset - NEIGHBORHOOD_SIZE)
  .forEach(j => { if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) spawnCache(i, j); }));
