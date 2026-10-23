import { API_URL } from "../constants/map";
import type { Stop, Pcd, DadosFiltro, Bus, CtmStop } from "../types/map";

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("token");

    if (!token || token === "undefined") {
        console.error("Token de autenticação não encontrado.");
        return {};
    }

    return {
        Authorization: `Bearer ${token}`,
    };
}

const CTM_STOPS_URL = "https://labgeo3.recife.ifpe.edu.br/apictm/stop";

let cachedStops: Stop[] | null = null;
let inFlightStopsRequest: Promise<Stop[]> | null = null;

export function calculateDistanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000; // Raio médio da Terra em metros
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

async function loadAllCtmStops(): Promise<Stop[]> {
    if (cachedStops) {
        return cachedStops;
    }

    if (inFlightStopsRequest) {
        return inFlightStopsRequest;
    }

    inFlightStopsRequest = (async () => {
        try {
            const response = await fetch(CTM_STOPS_URL);

            if (!response.ok) {
                console.error(
                    `Erro ao buscar paradas do CTM: HTTP ${response.status}`
                );
                return [];
            }

            let data: unknown;
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error("Erro ao analisar JSON retornado pelo CTM:", jsonError);
                return [];
            }

            if (!Array.isArray(data)) {
                console.error("Resposta da API do CTM não é um array válido.");
                return [];
            }

            const validStops: Stop[] = [];
            for (const item of data as CtmStop[]) {
                if (!item) continue;

                const lat = Number(item.lat);
                const lon = Number(item.lon);

                if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lon) ||
                    lat < -90 ||
                    lat > 90 ||
                    lon < -180 ||
                    lon > 180
                ) {
                    continue;
                }

                validStops.push({
                    stopId: String(item.id ?? ""),
                    stopName: String(item.name ?? ""),
                    stopLat: lat,
                    stopLon: lon,
                });
            }

            if (validStops.length > 0) {
                cachedStops = validStops;
            }

            return validStops;
        } catch (error) {
            console.error("Erro ao carregar paradas de ônibus do CTM:", error);
            return [];
        } finally {
            inFlightStopsRequest = null;
        }
    })();

    return inFlightStopsRequest;
}

export async function fetchStops(
    stop_lat?: number,
    stop_long?: number,
    radiusInMeters: number = 300
): Promise<Stop[]> {
    const allStops = await loadAllCtmStops();

    if (
        typeof stop_lat !== "number" ||
        typeof stop_long !== "number" ||
        !Number.isFinite(stop_lat) ||
        !Number.isFinite(stop_long)
    ) {
        return allStops;
    }

    return allStops.filter((stop) => {
        const dist = calculateDistanceInMeters(
            stop_lat,
            stop_long,
            stop.stopLat,
            stop.stopLon
        );
        return dist <= radiusInMeters;
    });
}

export async function fetchPcds(
    dadosFiltro: DadosFiltro
): Promise<Pcd[]> {
    const {
        minAge,
        maxAge,
        gender,
        disability,
        city,
        neighborhood: neigh,
    } = dadosFiltro;

    try {
        const response = await fetch(
            `${API_URL}/pcd/search?minAge=${minAge}&maxAge=${maxAge}&gender=${gender}&disability=${disability}&city=${city}&neigh=${neigh}`,
            {
                headers: getAuthHeaders(),
            }
        );

        if (!response.ok) {
            const text = await response.text();

            console.error(
                `Erro ao buscar PCDs: HTTP ${response.status}`,
                text
            );

            return [];
        }

        const data = await response.json();

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Erro ao buscar PCDs:", error);
        return [];
    }
}

interface ApiBus {
    busID: string;
    busLat: number;
    busLon: number;
    timeStamp?: string;
    tripHeadsign?: string;
    velocidade?: number;
}

export async function fetchBuses(
    latitude: number,
    longitude: number,
    radius: number = 2000
): Promise<Bus[] | null> {
    try {
        const response = await fetch(
            `http://192.168.0.77:8090/api/buses`,
            //`https://labgeo3.recife.ifpe.edu.br/api/buses`,
            //`${API_URL}/buses/nearby?lat=${latitude}&lon=${longitude}&radius=${radius}`,
            {
                headers: getAuthHeaders(),
            }
        );

        if (!response.ok) {
            const text = await response.text();
            console.error(`Erro ao buscar ônibus: HTTP ${response.status}`, text);
            return null;
        }

        const data: ApiBus[] = await response.json();

        console.log("API inexistente: " + `${API_URL}/buses/nearby?lat=${latitude}&lon=${longitude}&radius=${radius}`);

        if (!Array.isArray(data)) {
            return [];
        }

        const buses: Bus[] = data.map((apiBus) => ({
            bus_id: apiBus.busID,
            latitude: apiBus.busLat,
            longitude: apiBus.busLon,
            velocidade: apiBus.velocidade,
            trip_headsign: apiBus.tripHeadsign,
            recorded_at: apiBus.timeStamp
        }));

        return buses;
    } catch (error) {
        console.error("Erro ao buscar ônibus de gps:", error);
        return null;
    }
}