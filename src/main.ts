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

interface Geocache {
    coins: Geocoin[];
}
const geocoinList: Geocache = { coins: [] };

function geocoinListStr(geocoinList: Geocache) {
    let listStr = "";
    for (const geocoin of geocoinList.coins) {
        listStr += `${geocoin.mintingLocation.i}:${geocoin.mintingLocation.j}#${geocoin.serialNumber}`;
        listStr += " ";
    }
    return listStr;
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
//board.getCellsNearPoint({ lat: 0, lng: 0 });

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
    });
});

let geocoinsVal = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No geocoins yet...";

const geocahcePopup = new Map<Cell, Geocoin[]>();

function makegeocache(i: number, j: number) {
    const geocacheCell = board.getCellForPoint(leaflet.latLng({ lat: i, lng: j }));
    const geocache = leaflet.rectangle(board.getCellBounds(geocacheCell));

    const cellList: Geocache = { coins: [] };
    geocahcePopup.set(geocacheCell, cellList.coins);

    geocache.bindPopup(() => {
        let value = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
        for (let s = 0; s < value; s++) {
            if (cellList.coins[s]?.serialNumber != s) {
                cellList.coins.push({
                    mintingLocation: geocacheCell,
                    serialNumber: s
                });
            }
        }
        const container = document.createElement("div");
        container.innerHTML = `
                <div>There is a pit here at "${i},${j}", contains: <span id="value">${geocoinListStr(cellList)}</span></div>
                <button id="poke">poke</button>
                <button id="deposit">deposit</button>`;

        const poke = container.querySelector<HTMLButtonElement>("#poke")!;
        poke.addEventListener("click", () => {
            if (cellList.coins.length > 0) {
                value--;
                geocoinList.coins.push(cellList.coins.pop()!);
                container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
                    geocoinListStr(cellList);
                geocoinsVal++;
                statusPanel.innerHTML = `Geocoins: ${geocoinListStr(geocoinList)}`;
            }
        });

        const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
        deposit.addEventListener("click", () => {
            if (geocoinList.coins.length == 0) {
                return;
            }
            cellList.coins.push(geocoinList.coins.pop()!);
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = geocoinListStr(cellList);
            if (geocoinsVal == 0) {
                statusPanel.innerHTML = "No geocoins yet...";
            } else {
                statusPanel.innerHTML = `Geocoins: ${geocoinListStr(geocoinList)}`;
            }
        });
        return container;
    });
    geocache.addTo(map);
    return;
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < GEOCACHE_SPAWN_PROBABILITY) {
            makegeocache(i + Math.floor(MERRILL_CLASSROOM.lat / TILE_DEGREES) + 1, j + Math.floor(MERRILL_CLASSROOM.lng / TILE_DEGREES));
        }
    }
}

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
