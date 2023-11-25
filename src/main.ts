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

let geocoinList: Geocoin[] = [];

function geocoinListStr(geocoinList: Geocoin[]) {
    let listStr = "";
    for (const geocoin of geocoinList) {
        listStr += `${geocoin.mintingLocation.i}:${geocoin.mintingLocation.j}#${geocoin.serialNumber}`;
        listStr += " ";
    }
    return listStr;
}

interface Momento<T> {
    toMomento(): T;
    fromMomento(momento: T): void;
}

class Geocache implements Momento<string> {
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

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = `Geocoins: ${geocoinList.length}`;

let geocachePopup = new Map<Cell, string>();
const geocacheList: leaflet.Rectangle[] = [];

let coordinates: leaflet.LatLng[] = [];
coordinates.push(playerMarker.getLatLng());
const polyline = leaflet.polyline(coordinates, { color: "red" }).addTo(map);

loadLocal();
map.setView(playerMarker.getLatLng());

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
        const value = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
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
                <button id="collect">collect</button>
                <button id="deposit">deposit</button>`;

        const collect = container.querySelector<HTMLButtonElement>("#collect")!;
        collect.addEventListener("click", () => {
            if (newGeocacheCell.coins.length > 0) {
                geocoinList.push(newGeocacheCell.coins.pop()!);
                container.querySelector<HTMLSpanElement>("#value")!.innerHTML = (geocoinListStr(newGeocacheCell.coins));
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
            statusPanel.innerHTML = `Geocoins: ${geocoinList.length}`;
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

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
    navigator.geolocation.watchPosition((position) => {
        playerMarker.setLatLng(
            leaflet.latLng(position.coords.latitude, position.coords.longitude)
        );
        map.setView(playerMarker.getLatLng());
        for (const geocache of geocacheList) {
            geocache.remove();
        }
        regenerateCells();
        coordinates = [leaflet.latLng(position.coords.latitude, position.coords.longitude)];
        polyline.setLatLngs(coordinates);
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
    coordinates.push(playerMarker.getLatLng());
    polyline.setLatLngs(coordinates);
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

const resetButton = document.querySelector("#reset")!;
resetButton.addEventListener("click", () => {
    const resetPrompt = prompt("Reset game state? (Yes / No)")!;
    if (resetPrompt.toLowerCase() == "yes") {
        geocoinList.length = 0;
        `Geocoins: ${geocoinList.length}`;
        for (const geocache of geocacheList) {
            geocache.remove();
        }
        geocacheList.length = 0;
        coordinates.length = 0;
        geocachePopup.clear();
        playerMarker.setLatLng(MERRILL_CLASSROOM);
        polyline.setLatLngs(coordinates);
        map.setView(playerMarker.getLatLng());
        regenerateCells();
    }
});

interface Data {
    geocoinListData: Geocoin[];
    geocachePopupData: [Cell, string][];
    playerLocationData: leaflet.LatLng;
    coordinateData: leaflet.LatLng[];
}

function saveLocal() {
    const saveData: Data = {
        geocoinListData: geocoinList,
        geocachePopupData: Array.from(geocachePopup),
        playerLocationData: playerMarker.getLatLng(),
        coordinateData: coordinates,
    };
    localStorage.setItem("playerData", JSON.stringify(saveData));
}

function loadLocal() {
    const loadData = localStorage.getItem("playerData");
    let data: Data;
    if (loadData) {
        data = JSON.parse(loadData) as Data;
        geocoinList = data.geocoinListData;
        geocachePopup = new Map(data.geocachePopupData);
        playerMarker.setLatLng(data.playerLocationData);
        coordinates = data.coordinateData;
    } else {
        data = {
            geocoinListData: [],
            geocachePopupData: [],
            playerLocationData: MERRILL_CLASSROOM,
            coordinateData: [],
        };
    }
}

function tick() {
    saveLocal();
    requestAnimationFrame(tick);
    console.log("saving");
}
tick();