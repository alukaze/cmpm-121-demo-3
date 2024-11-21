import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board } from "./board.ts";

// Configuration constants
const TILE_WIDTH = 1e-4;
const TILE_VISIBILITY_RADIUS = 8;
const CACHE_SPAWN_PROBABILITY = 0.1; // Chance for a cache to spawn in a cell
const MIN_COINS = 1;
const MAX_COINS = 10;

// Initialize player's position
let playerLocation = leaflet.latLng(36.98949379578401, -122.06277128548504);

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
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Add player marker
const playerMarker = leaflet.marker(playerLocation)
  .addTo(map)
  .bindTooltip("That's you!");

// Display player points
let playerPoints = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Coins: 0";

// Cache and inventory management
interface Memento<T> {
  toMemento(): T;
  fromMemento(memento: T): void;
}

class Geocache implements Memento<string> {
  i: number;
  j: number;
  coins: { i: number; j: number; number: number }[];

  constructor(i: number, j: number, coins: { i: number; j: number; number: number }[] = []) {
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
  const inventoryPanel = document.querySelector<HTMLDivElement>("#inventoryPanel")!;
  inventoryPanel.innerHTML = "<h3>Inventory:</h3>";
  inventoryPanel.innerHTML += inventory.length === 0
    ? "<p>No coins collected yet.</p>"
    : "<ul>" + inventory.map((coin) => `<li>- ${coin.i}: ${coin.j} #${coin.number}</li>`).join("") + "</ul>";
}

// Spawn caches with random coin counts
function spawnCache(cell: { i: number; j: number }) {
  const bounds = board.getCellBounds(cell);
  const key = `${cell.i},${cell.j}`;

  if (!(key in cacheData)) {
    if (luck(key) >= CACHE_SPAWN_PROBABILITY) return;

    const numberOfCoins = Math.floor(luck(key + "_coins") * (MAX_COINS - MIN_COINS + 1)) + MIN_COINS;
    cacheData[key] = new Geocache(cell.i, cell.j, Array.from({ length: numberOfCoins }, (_, number) => ({
      i: cell.i,
      j: cell.j,
      number,
    })));
  }

  const cache = cacheData[key];
  leaflet.rectangle(bounds)
    .addTo(map)
    .bindPopup(() => {
      const popupDiv = document.createElement("div");
      const coinList = cache.coins;
      popupDiv.innerHTML = `
        <div>Cache found at "${cell.i},${cell.j}". Coins: <span id="value">${coinList.length}</span></div>
        <button id="collect">Collect a Coin</button>
        <button id="deposit">Deposit a Coin</button>
        <div id="coinList">Coins: <br><ul>${coinList
          .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`).join("")}</ul></div>`;

      const collectButton = popupDiv.querySelector<HTMLButtonElement>("#collect")!;
      const depositButton = popupDiv.querySelector<HTMLButtonElement>("#deposit")!;
      const valueSpan = popupDiv.querySelector<HTMLSpanElement>("#value")!;
      const coinListDiv = popupDiv.querySelector<HTMLDivElement>("#coinList")!;

      collectButton.addEventListener("click", () => {
        if (coinList.length > 0) {
          const collectedCoin = coinList.pop()!;
          inventory.push(collectedCoin);
          playerPoints++;
          valueSpan.innerHTML = coinList.length.toString();
          coinListDiv.innerHTML = `Coins: <br><ul>${coinList
            .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`).join("")}</ul>`;
          statusPanel.innerHTML = `Coins: ${playerPoints}`;
          updateInventoryDisplay();
        }
      });

      depositButton.addEventListener("click", () => {
        if (inventory.length > 0) {
          const coinToDeposit = inventory.pop()!;
          cache.coins.push(coinToDeposit);
          playerPoints--;
          valueSpan.innerHTML = cache.coins.length.toString();
          coinListDiv.innerHTML = `Coins: <br><ul>${cache.coins
            .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`).join("")}</ul>`;
          statusPanel.innerHTML = `Coins: ${playerPoints}`;
          updateInventoryDisplay();
        }
      });

      return popupDiv;
    });
}

// Update visible caches
function updateCaches() {
  const visibleCells = board.getCellsNearPoint(playerLocation);
  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });
  visibleCells.forEach((cell) => spawnCache(cell));
}

// Save and load caches
function saveCaches(): Record<string, string> {
  const savedData: Record<string, string> = {};
  for (const [key, cache] of Object.entries(cacheData)) {
    savedData[key] = cache.toMemento();
  }
  return savedData;
}

function loadCaches(savedData: Record<string, string>) {
  for (const [key, momento] of Object.entries(savedData)) {
    const [i, j] = key.split(",").map(Number);
    const cache = new Geocache(i, j);
    cache.fromMemento(momento);
    cacheData[key] = cache;
  }
}

// Move player
function movePlayer(dx: number, dy: number) {
  playerLocation = leaflet.latLng(playerLocation.lat + dy * TILE_WIDTH, playerLocation.lng + dx * TILE_WIDTH);
  playerMarker.setLatLng(playerLocation);
  map.panTo(playerLocation);
  updateCaches();
}

// Directional movement buttons
document.querySelector<HTMLButtonElement>("#north")!.addEventListener("click", () => movePlayer(0, 1));
document.querySelector<HTMLButtonElement>("#south")!.addEventListener("click", () => movePlayer(0, -1));
document.querySelector<HTMLButtonElement>("#west")!.addEventListener("click", () => movePlayer(-1, 0));
document.querySelector<HTMLButtonElement>("#east")!.addEventListener("click", () => movePlayer(1, 0));

// Initialize caches
updateCaches();
