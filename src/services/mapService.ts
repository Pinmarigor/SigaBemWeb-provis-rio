import { API_URL } from "../constants/map";
import type { Stop, Pcd, DadosFiltro, Bus } from "../types/map";

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

export async function fetchStops(
    stop_lat: number,
    stop_long: number
): Promise<Stop[]> {
    try {
        const response = await fetch(
            `${API_URL}/stop/nearby?stop_lat=${stop_lat}&stop_long=${stop_long}`,
            {
                headers: getAuthHeaders(),
            }
        );

        const text = await response.text();

        if (!response.ok) {
            console.error(
                `Erro ao buscar paradas: HTTP ${response.status}`,
                text
            );
            return [];
        }

        const jsonData = JSON.parse(text);

        return Array.isArray(jsonData) ? jsonData : [];
    } catch (error) {
        console.error("Erro ao buscar paradas de ônibus:", error);
        return [];
    }
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
            `${API_URL}/buses/nearby?lat=${latitude}&lon=${longitude}&radius=${radius}`,
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