import leaflet from "leaflet";

interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const key = `${cell.i},${cell.j}`;
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);
    return this.getCanonicalCell({ i, j });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const { i, j } = cell;
    const lat1 = i * this.tileWidth;
    const lng1 = j * this.tileWidth;
    const lat2 = (i + 1) * this.tileWidth;
    const lng2 = (j + 1) * this.tileWidth;
    return leaflet.latLngBounds([
      [lat1, lng1],
      [lat2, lng2],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const { i: originI, j: originJ } = this.getCellForPoint(point);

    for (let di = -this.tileVisibilityRadius; di <= this.tileVisibilityRadius; di++) {
      for (let dj = -this.tileVisibilityRadius; dj <= this.tileVisibilityRadius; dj++) {
        resultCells.push(this.getCanonicalCell({ i: originI + di, j: originJ + dj }));
      }
    }

    return resultCells;
  }
}
