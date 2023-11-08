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
        this.knownCells = new Map();
    }

    private getCanonicalCell(cell: Cell): Cell {
        const { i, j } = cell;
        const key = [i, j].toString();
        if (!this.knownCells.get(key)) {
            this.knownCells.set(key, cell);
        }
        return this.knownCells.get(key)!;
    }

    getCellForPoint(point: leaflet.LatLng): Cell {
        const i = point.lat;
        const j = point.lng;
        return this.getCanonicalCell({ i, j });
    }

    // getCellBounds(cell: Cell): leaflet.LatLngBounds {
    //     // ...
    // }

    // // const aBox = leaflet.latLngBounds([
    // //     [36.9995, -122.0533],
    // //     [36.9994, -122.0532]
    // // ]);

    // getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    //     const resultCells: Cell[] = [];
    //     const originCell = this.getCellForPoint(point);
    //     // ...
    //     return resultCells;
    // }
}
