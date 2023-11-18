import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board.ts";
import { Cell } from "./board.ts";

interface Geocoin {
    mintingLocation: Cell;
    serialNumber: number;
}

// interface Geocache {
//     coins: Geocoin[];
// }
const geocoinList: Geocoin[] = [];

function geocoinListStr(geocoinList: Geocoin[]) {
    let listStr = "";
    for (const geocoin of geocoinList) {
        listStr += `${geocoin.mintingLocation.i}:${geocoin.mintingLocation.j}#${geocoin.serialNumber}`;
        listStr += " ";
    }
    return listStr;
}

// interface Momento<T> {
//     toMomento(): T;
//     fromMomento(momento: T): void;
// }

class Geocache {
    coins: Geocoin[];
    description: string;

    constructor(cell: Cell) {
        const A = ["lucky", "ominous", "whimsical", "superb"];
        const B = ["bucket", "targeocache", "slab", "receptacle", "platform", "pot"];

        const selectedA = A[Math.floor(luck(["descA", cell.i, cell.j].toString()) * A.length)];
        const selectedB = B[Math.floor(luck(["descB", cell.i, cell.j].toString()) * B.length)];
        this.description = `${selectedA} ${selectedB}`;

        const numInitialCoins = Math.floor(luck(["intialCoins", cell.i, cell.j].toString()) * 3);
        this.coins = [];
        for (let i = 0; i < numInitialCoins; i++) {
            this.coins.push({ mintingLocation: cell, serialNumber: i });
        }
    }

    toMomento(): string {
        return JSON.stringify(this.coins);
    }

    fromMomento(momento: string) {
        this.coins = JSON.parse(momento) as Geocoin[];
    }

}

const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: -122.0533,
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const GEOCACHE_SPAWN_PROBABILITY = 0.1;

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: MERRILL_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
});

leaflet
    .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
            "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
    })
    .addTo(map);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
    navigator.geolocation.watchPosition((position) => {
        playerMarker.setLatLng(
            leaflet.latLng(position.coords.latitude, position.coords.longitude)
        );
        map.setView(playerMarker.getLatLng());
        regenerateCells();
    });
});

function movePlayer(i: number, j: number) {
    playerMarker.setLatLng(
        leaflet.latLng(playerMarker.getLatLng().lat + (i * TILE_DEGREES), playerMarker.getLatLng().lng + (j * TILE_DEGREES))
    );
    map.setView(playerMarker.getLatLng());
    for (const geocache of geocacheList) {
        geocache.remove();
    }
    regenerateCells();
}

const northButton = document.querySelector("#north")!;
northButton.addEventListener("click", () => {
    movePlayer(1, 0);
});

const southButton = document.querySelector("#south")!;
southButton.addEventListener("click", () => {
    movePlayer(-1, 0);
});

const westButton = document.querySelector("#west")!;
westButton.addEventListener("click", () => {
    movePlayer(0, -1);
});

const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("click", () => {
    movePlayer(0, 1);
    regenerateCells();
});

let geocoinsVal = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No geocoins yet...";

const geocachePopup = new Map<Cell, string>();
const geocacheList: leaflet.Rectangle[] = [];

regenerateCells();

function makegeocache(i: number, j: number) {
    const geocacheCell = board.getCellForPoint(leaflet.latLng({ lat: i, lng: j }));

    const newGeocacheCell = new Geocache(geocacheCell);
    if (geocachePopup.has(geocacheCell)) {
        newGeocacheCell.fromMomento(geocachePopup.get(geocacheCell)!);
    } else {
        geocachePopup.set(geocacheCell, newGeocacheCell.toMomento());
    }

    const geocache = leaflet.rectangle(board.getCellBounds(geocacheCell));

    const cellList: Geocoin[] = [];
    geocachePopup.set(geocacheCell, newGeocacheCell.toMomento());

    geocache.bindPopup(() => {
        let value = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
        for (let s = 0; s < value; s++) {
            if (cellList[s]?.serialNumber != s) {
                cellList.push({
                    mintingLocation: geocacheCell,
                    serialNumber: s
                });
            }
        }
        const container = document.createElement("div");
        container.innerHTML = `
                <div>There is a pit here at "${i},${j}", contains: <span id="value">${(geocoinListStr(newGeocacheCell.coins))}</span></div>
                <button id="poke">poke</button>
                <button id="deposit">deposit</button>`;

        const poke = container.querySelector<HTMLButtonElement>("#poke")!;
        poke.addEventListener("click", () => {
            if (cellList.length > 0) {
                value--;
                geocoinList.push(newGeocacheCell.coins.pop()!);
                container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
                    (geocoinListStr(newGeocacheCell.coins));
                geocoinsVal++;
                geocachePopup.set(geocacheCell, newGeocacheCell.toMomento());
                statusPanel.innerHTML = `Geocoins: ${geocoinList.length}`;
            }
        });

        const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
        deposit.addEventListener("click", () => {
            if (geocoinList.length == 0) {
                return;
            }
            newGeocacheCell.coins.push(geocoinList.pop()!);
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = (geocoinListStr(newGeocacheCell.coins));
            geocachePopup.set(geocacheCell, newGeocacheCell.toMomento());
            if (geocoinsVal == 0) {
                statusPanel.innerHTML = "No geocoins yet...";
            } else {
                statusPanel.innerHTML = `Geocoins: ${geocoinList.length}`;
            }
        });
        return container;
    });
    geocache.addTo(map);
    geocacheList.push(geocache);
    return;
}

function regenerateCells() {
    for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
        for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
            const playerLat = i + Math.floor(playerMarker.getLatLng().lat / TILE_DEGREES);
            const playerLng = j + Math.floor(playerMarker.getLatLng().lng / TILE_DEGREES);
            if (luck([playerLat, playerLng].toString()) < GEOCACHE_SPAWN_PROBABILITY) {
                makegeocache(playerLat, playerLng);
            }
        }
    }
}

// j + Math.floor(MERRILL_CLASSROOM.lng / TILE_DEGREES)
// function luck(situation: string) {
//     return 0.47;
//   }

//   interface Cell {
//     i: number;
//     j: number;
//   }

//   interface Geocoin {
//     mintingLocation: Cell;
//     serialNumber: number;
//   }

//   class Geocache {
//     coins: Geocoin[];
//     description: string;

//     constructor(cell: Cell) {
//       const A = ["lucky", "ominous", "whimsical", "superb"];
//       const B = ["bucket", "targeocache", "slab", "receptacle", "platform", "pot"];

//       const selectedA = A[Math.floor(luck(["descA", cell.i, cell.j].toString())*A.length)];
//       const selectedB = B[Math.floor(luck(["descB", cell.i, cell.j].toString())*B.length)];
//       this.description = `${selectedA} ${selectedB}`;

//       const numInitialCoins = Math.floor(luck(["intialCoins", cell.i, cell.j].toString())*3);
//       this.coins = [];
//       for(let i = 0; i < numInitialCoins; i++) {
//         this.coins.push({mintingLocation: cell, serialNumber: i});
//       }
//     }

//     toMomento(): string {
//       return this.coins.map((coin) => [coin.mintingLocation.i, coin.mintingLocation.j, coin.serialNumber].toString()).join(';');
//     }
//   }
//  const geocacheMap = new Map<string, leaflet.Layer>();
