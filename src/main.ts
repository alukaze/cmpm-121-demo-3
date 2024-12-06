import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board } from "./board.ts";

// Configuration constants
const TILE_WIDTH = 1e-4;
const TILE_VISIBILITY_RADIUS = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const MIN_COINS = 1;
const MAX_COINS = 10;

// Initialize player's position
let playerLocation = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Persistent storage keys
const STORAGE_KEYS = {
  PLAYER_LOCATION: "player_location",
  PLAYER_POINTS: "player_points",
  INVENTORY: "inventory",
  CACHE_DATA: "cache_data",
  MOVEMENT_HISTORY: "movement_history",
};

// Initialize board and map
const board = new Board(TILE_WIDTH, TILE_VISIBILITY_RADIUS);
const map = leaflet.map(document.getElementById("map")!, {
  center: playerLocation,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add map tiles
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Add player marker
const playerMarker = leaflet.marker(playerLocation)
  .addTo(map)
  .bindTooltip("That's you!");

// Display player points
let playerPoints = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Coins: 0<br>Geolocation: Off";

// Initialize movement history as a polyline
let movementHistory: leaflet.LatLng[] = [playerLocation];
const movementPolyline = leaflet.polyline(movementHistory, { color: "red" })
  .addTo(map);

// Cache and inventory management
interface Memento<T> {
  toMemento(): T;
  fromMemento(memento: T): void;
}

class Geocache implements Memento<string> {
  i: number;
  j: number;
  coins: { i: number; j: number; number: number }[];

  constructor(
    i: number,
    j: number,
    coins: { i: number; j: number; number: number }[] = [],
  ) {
    this.i = i;
    this.j = j;
    this.coins = coins;
  }

  toMemento(): string {
    return JSON.stringify(this.coins);
  }

  fromMemento(memento: string): void {
    this.coins = JSON.parse(memento);
  }
}

const cacheData: Record<string, Geocache> = {};
const inventory: { i: number; j: number; number: number }[] = [];

// Update inventory display
function updateInventoryDisplay() {
  const inventoryPanel = document.querySelector<HTMLDivElement>(
    "#inventoryPanel",
  )!;
  inventoryPanel.innerHTML = "<h3>Inventory:</h3>";
  inventoryPanel.innerHTML += inventory.length === 0
    ? "<p>No coins collected yet.</p>"
    : "<ul>" + inventory.map((coin) => {
      // Create a clickable coin identifier
      const coinIdentifier =
        `<li><a href="#" class="coin-link" data-i="${coin.i}" data-j="${coin.j}" data-number="${coin.number}">${coin.i}: ${coin.j} #${coin.number}</a></li>`;
      return coinIdentifier;
    }).join("") + "</ul>";

  // Add click event listeners to coin links
  document.querySelectorAll<HTMLAnchorElement>(".coin-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      const i = parseInt(link.getAttribute("data-i")!);
      const j = parseInt(link.getAttribute("data-j")!);
      const _number = parseInt(link.getAttribute("data-number")!);

      // Find the cache for this coin
      const cache = cacheData[`${i},${j}`];
      if (cache) {
        const bounds = board.getCellBounds({ i, j });
        const center = bounds.getCenter();
        // Center the map
        map.panTo(center);
      }
    });
  });
}

// Update status panel without overriding geolocation status
function updateStatusPanel() {
  const geolocationStatus = geolocationInterval
    ? "Geolocation: On"
    : "Geolocation: Off";
  statusPanel.innerHTML = `Coins: ${playerPoints}<br>${geolocationStatus}`;
}

// Collect and deposit coin handlers
function collectCoin(
  coinList: { i: number; j: number; number: number }[],
  valueSpan: HTMLSpanElement,
  coinListDiv: HTMLDivElement,
) {
  if (coinList.length > 0) {
    const collectedCoin = coinList.pop()!;
    inventory.push(collectedCoin);
    playerPoints++;
    valueSpan.innerHTML = coinList.length.toString();
    coinListDiv.innerHTML = `Coins: <br><ul>${
      coinList
        .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`).join("")
    }</ul>`;
    updateStatusPanel();
    updateInventoryDisplay();
    saveGameData();
  }
}

function depositCoin(
  coinList: { i: number; j: number; number: number }[],
  valueSpan: HTMLSpanElement,
  coinListDiv: HTMLDivElement,
) {
  if (inventory.length > 0) {
    const coinToDeposit = inventory.pop()!;
    coinList.push(coinToDeposit);
    playerPoints--;
    valueSpan.innerHTML = coinList.length.toString();
    coinListDiv.innerHTML = `Coins: <br><ul>${
      coinList
        .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`).join("")
    }</ul>`;
    updateStatusPanel();
    updateInventoryDisplay();
    saveGameData();
  }
}

// Spawn caches with random coin counts
function spawnCache(cell: { i: number; j: number }) {
  const bounds = board.getCellBounds(cell);
  const key = `${cell.i},${cell.j}`;

  if (!(key in cacheData)) {
    if (luck(key) >= CACHE_SPAWN_PROBABILITY) return;

    const numberOfCoins =
      Math.floor(luck(key + "_coins") * (MAX_COINS - MIN_COINS + 1)) +
      MIN_COINS;
    cacheData[key] = new Geocache(
      cell.i,
      cell.j,
      Array.from({ length: numberOfCoins }, (_, number) => ({
        i: cell.i,
        j: cell.j,
        number,
      })),
    );
  }

  const cache = cacheData[key];
  leaflet.rectangle(bounds)
    .addTo(map)
    .bindPopup(() => {
      const popupDiv = document.createElement("div");
      const coinList = cache.coins;
      popupDiv.innerHTML =
        `<div>Cache found at "${cell.i},${cell.j}". Coins: <span id="value">${coinList.length}</span></div>
        <button id="collect">Collect a Coin</button>
        <button id="deposit">Deposit a Coin</button>
        <div id="coinList">Coins: <br><ul>${
          coinList
            .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`)
            .join("")
        }</ul></div>`;

      const collectButton = popupDiv.querySelector<HTMLButtonElement>(
        "#collect",
      )!;
      const depositButton = popupDiv.querySelector<HTMLButtonElement>(
        "#deposit",
      )!;
      const valueSpan = popupDiv.querySelector<HTMLSpanElement>("#value")!;
      const coinListDiv = popupDiv.querySelector<HTMLDivElement>("#coinList")!;

      collectButton.addEventListener(
        "click",
        () => collectCoin(coinList, valueSpan, coinListDiv),
      );
      depositButton.addEventListener(
        "click",
        () => depositCoin(coinList, valueSpan, coinListDiv),
      );

      return popupDiv;
    });
}

// Update visible caches
function updateCaches() {
  const visibleCells = board.getCellsNearPoint(playerLocation);
  map.eachLayer((layer: leaflet.Layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });
  visibleCells.forEach((cell) => spawnCache(cell));
}

// Save and load caches
function saveCaches(): Record<string, string> {
  const savedData: Record<string, string> = {};
  for (const key in cacheData) {
    const cache = cacheData[key];
    savedData[key] = cache.toMemento();
  }
  return savedData;
}

function loadCaches(savedData: Record<string, string>) {
  for (const key in savedData) {
    const momento = savedData[key];
    const [i, j] = key.split(",").map(Number);
    const cache = new Geocache(i, j);
    cache.fromMemento(momento);
    cacheData[key] = cache;
  }
}

// Save game data to localStorage
function saveGameData() {
  localStorage.setItem(
    STORAGE_KEYS.PLAYER_LOCATION,
    JSON.stringify(playerLocation),
  );
  localStorage.setItem(
    STORAGE_KEYS.PLAYER_POINTS,
    JSON.stringify(playerPoints),
  );
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  localStorage.setItem(STORAGE_KEYS.CACHE_DATA, JSON.stringify(saveCaches()));
  localStorage.setItem(
    STORAGE_KEYS.MOVEMENT_HISTORY,
    JSON.stringify(movementHistory),
  );
}

// Load game data from localStorage
function loadGameData() {
  const savedLocation = localStorage.getItem(STORAGE_KEYS.PLAYER_LOCATION);
  const savedPoints = localStorage.getItem(STORAGE_KEYS.PLAYER_POINTS);
  const savedInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  const savedCacheData = localStorage.getItem(STORAGE_KEYS.CACHE_DATA);
  const savedMovementHistory = localStorage.getItem(
    STORAGE_KEYS.MOVEMENT_HISTORY,
  );

  if (savedLocation) playerLocation = leaflet.latLng(JSON.parse(savedLocation));
  if (savedPoints) playerPoints = JSON.parse(savedPoints);
  if (savedInventory) Object.assign(inventory, JSON.parse(savedInventory));
  if (savedCacheData) loadCaches(JSON.parse(savedCacheData));

  // Reset movement history and polyline
  movementHistory = [playerLocation];
  movementPolyline.setLatLngs(movementHistory);

  if (savedMovementHistory) {
    const parsedHistory = JSON.parse(savedMovementHistory).map((
      coords: [number, number],
    ) => leaflet.latLng(coords));
    if (parsedHistory.length > 0) {
      movementHistory = [playerLocation];
    }
  }

  movementPolyline.setLatLngs(movementHistory);

  map.setView(playerLocation, 19);

  playerMarker.setLatLng(playerLocation);

  updateStatusPanel();
  updateInventoryDisplay();
}
function updatePlayerLocation(dx: number, dy: number) {
  playerLocation = leaflet.latLng(
    playerLocation.lat + dy * TILE_WIDTH,
    playerLocation.lng + dx * TILE_WIDTH,
  );

  // Update movement history
  movementHistory.push(playerLocation);
  saveGameData();
}

function updateMap() {
  playerMarker.setLatLng(playerLocation);
  map.panTo(playerLocation);
  movementPolyline.setLatLngs(movementHistory);
  updateCaches();
}

// Move player
function movePlayer(dx: number, dy: number) {
  updatePlayerLocation(dx, dy);
  updateMap();
  updateCaches();
  saveGameData();
}

// A reusable function to set up directional movement buttons
function setupDirectionalButton(buttonId: string, dx: number, dy: number) {
  document.querySelector<HTMLButtonElement>(buttonId)!.addEventListener(
    "click",
    () => {
      movePlayer(dx, dy);
    },
  );
}

// Initialize all movement buttons
setupDirectionalButton("#north", 0, 1);
setupDirectionalButton("#south", 0, -1);
setupDirectionalButton("#west", -1, 0);
setupDirectionalButton("#east", 1, 0);

// Geolocation tracking
let geolocationInterval: number | null = null;

function startGeolocationTracking() {
  geolocationInterval = setInterval(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        playerLocation = leaflet.latLng(
          position.coords.latitude,
          position.coords.longitude,
        );
        playerMarker.setLatLng(playerLocation);
        map.panTo(playerLocation);

        // Update movement history
        movementHistory.push(playerLocation);
        movementPolyline.setLatLngs(movementHistory);

        updateCaches();
        saveGameData();
      });
    }
  }, 1000); // Update every second
  updateStatusPanel();
}

function stopGeolocationTracking() {
  if (geolocationInterval) {
    clearInterval(geolocationInterval);
    geolocationInterval = null;
  }
  updateStatusPanel();
}

document.querySelector<HTMLButtonElement>("#sensor")!.addEventListener(
  "click",
  () => {
    if (geolocationInterval) {
      stopGeolocationTracking();
    } else {
      startGeolocationTracking();
    }
  },
);

function resetGame() {
  const confirmation = prompt(
    "Are you sure you want to erase all game progress? This action cannot be undone. Type 'yes' if you are sure.",
  );
  if (confirmation && confirmation.toLowerCase() === "yes") {
    clearGameState();
    resetMap();
    restoreCachesAndCoins();
    updateStatusPanel();
    updateInventoryDisplay();
  }
}

function clearGameState() {
  // Reset player-specific logic
  playerLocation = leaflet.latLng(36.98949379578401, -122.06277128548504);
  playerPoints = 0;
  inventory.length = 0;
  movementHistory = [playerLocation];
  Object.keys(cacheData).forEach((key) => delete cacheData[key]);

  // Clear localStorage
  localStorage.removeItem(STORAGE_KEYS.PLAYER_LOCATION);
  localStorage.removeItem(STORAGE_KEYS.PLAYER_POINTS);
  localStorage.removeItem(STORAGE_KEYS.INVENTORY);
  localStorage.removeItem(STORAGE_KEYS.CACHE_DATA);
  localStorage.removeItem(STORAGE_KEYS.MOVEMENT_HISTORY);
}

function resetMap() {
  // Reset map-related state
  map.setView(playerLocation, 19);
  playerMarker.setLatLng(playerLocation);
  movementPolyline.setLatLngs(movementHistory);

  updateCaches(); // Re-render caches
}

function restoreCachesAndCoins() {
  // Save a copy of all coins before reset
  const coinsToReturn = [...inventory];
  const savedCaches = { ...cacheData };

  // Restore original caches and coins in sorted order
  Object.keys(savedCaches).forEach((key) => {
    const { i, j, coins } = savedCaches[key];
    if (!(key in cacheData)) {
      cacheData[key] = new Geocache(i, j);
    }
    // Ensure coins are added only once
    cacheData[key].coins = coins.slice().sort((a, b) => a.number - b.number);
  });

  // Return collected coins to their respective caches in sorted order
  coinsToReturn.forEach((coin) => {
    const cacheKey = `${coin.i},${coin.j}`;
    if (!(cacheKey in cacheData)) {
      cacheData[cacheKey] = new Geocache(coin.i, coin.j);
    }
    // Avoid adding duplicates by checking if the coin is already in the cache
    if (!cacheData[cacheKey].coins.some((c) => c.number === coin.number)) {
      cacheData[cacheKey].coins.push(coin);
      cacheData[cacheKey].coins.sort((a, b) => a.number - b.number);
    }
  });
}

document.querySelector<HTMLButtonElement>("#reset")!.addEventListener(
  "click",
  resetGame,
);

// Load game data and initialize caches
loadGameData();
updateCaches();
