import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board } from "./board.ts";

// Constants
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const TILE_WIDTH = 1e-4;
const TILE_VISIBILITY_RADIUS = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Initialize board and map
const board = new Board(TILE_WIDTH, TILE_VISIBILITY_RADIUS);
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM).addTo(map).bindTooltip("That's you!");

// Points display
let playerPoints = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Coins: 0";

// Cache and inventory management
const cacheData: Record<string, { coins: { i: number; j: number; number: number }[] }> = {};
const inventory: { i: number; j: number; number: number }[] = [];

function getCoinId(cell: { i: number; j: number }, number: number): string {
  return `${cell.i},${cell.j},#${number}`;
}

function updateInventoryDisplay() {
  const inventoryPanel = document.querySelector<HTMLDivElement>("#inventoryPanel")!;
  inventoryPanel.innerHTML = "<h3>Inventory:</h3>";
  if (inventory.length === 0) {
    inventoryPanel.innerHTML += "<p>No coins collected yet.</p>";
  } else {
    inventoryPanel.innerHTML += "<ul>" + inventory
      .map((coin) => `<li>- ${coin.i}: ${coin.j} #${coin.number}</li>`)
      .join("") + "</ul>";
  }
}

function spawnCache(cell: { i: number; j: number }) {
  const bounds = board.getCellBounds(cell);
  const key = `${cell.i},${cell.j}`;

  if (!(key in cacheData)) {
    const numberOfCoins = Math.floor(luck(key) * 100);
    cacheData[key] = { coins: Array.from({ length: numberOfCoins }, (_, number) => ({ i: cell.i, j: cell.j, number })) };
  }

  const rect = leaflet.rectangle(bounds)
    .addTo(map)
    .bindPopup(() => {
      const popupDiv = document.createElement("div");
      const coinList = cacheData[key].coins;
      popupDiv.innerHTML = `
        <div>Cache found at "${cell.i},${cell.j}". Coins available: <span id="value">${coinList.length}</span></div>
        <button id="collect">Collect a Coin</button>
        <button id="deposit">Deposit a Coin</button>
        <div id="coinList">Coins: <br><ul>${coinList
          .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`)
          .join("")}</ul></div>`;

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
            .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`)
            .join("")}</ul>`;
          statusPanel.innerHTML = `Coins: ${playerPoints}`;
          updateInventoryDisplay();
        }
      });

      depositButton.addEventListener("click", () => {
        if (inventory.length > 0) {
          const coinToDeposit = inventory.pop()!;
          cacheData[key].coins.push(coinToDeposit);
          playerPoints--;
          valueSpan.innerHTML = cacheData[key].coins.length.toString();
          coinListDiv.innerHTML = `Coins: <br><ul>${cacheData[key].coins
            .map((coin) => `<li>${coin.i}: ${coin.j} #${coin.number}</li>`)
            .join("")}</ul>`;
          statusPanel.innerHTML = `Points: ${playerPoints}`;
          updateInventoryDisplay();
        }
      });

      return popupDiv;
    });
}

function updateCaches() {
  const visibleCells = board.getCellsNearPoint(OAKES_CLASSROOM);
  visibleCells.forEach((cell) => {
    const key = `${cell.i},${cell.j}`;
    if (luck(key) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell);
    }
  });
}

updateCaches();
