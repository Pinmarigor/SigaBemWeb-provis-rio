import type { Stop, StopAddress } from "../types/map";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/reverse";
// Intervalo de segurança ligeiramente superior a 1000ms para respeitar rigorosamente a política pública do Nominatim (<= 1 req/s)
const MIN_REQUEST_INTERVAL_MS = 1100;

interface GeocodeQueueItem {
    stopId: string;
    lat: number;
    lon: number;
    cacheKey: string;
    selectionId: number;
}

export type AddressUpdateListener = (
    stopId: string,
    address: StopAddress,
    selectionId: number
) => void;

// Cache em memória: chave é `${stopId}:${lat.toFixed(6)},${lon.toFixed(6)}`
const addressCache = new Map<string, StopAddress>();

// Fila global e controle de frequência
const queue: GeocodeQueueItem[] = [];
let isProcessingQueue = false;
let lastRequestTimestamp = 0;

// Conjunto de ouvintes registrados (ex: componentes react)
const listeners = new Set<AddressUpdateListener>();

export function getAddressCacheKey(
    stopId: string,
    lat: number,
    lon: number
): string {
    return `${stopId}:${lat.toFixed(6)},${lon.toFixed(6)}`;
}

export function getStopAddressFromCache(
    stopId: string,
    lat: number,
    lon: number
): StopAddress | undefined {
    return addressCache.get(getAddressCacheKey(stopId, lat, lon));
}

export function subscribeToAddressUpdates(
    listener: AddressUpdateListener
): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function notifyListeners(
    stopId: string,
    address: StopAddress,
    selectionId: number
): void {
    for (const listener of listeners) {
        try {
            listener(stopId, address, selectionId);
        } catch (error) {
            console.error("Erro ao notificar ouvinte de geocodificação:", error);
        }
    }
}

export function formatNominatimAddress(data: {
    address?: Record<string, string>;
    display_name?: string;
}): string {
    if (!data) {
        return "Endereço não identificado";
    }

    if (data.address && typeof data.address === "object") {
        const addr = data.address;
        const street =
            addr.road ||
            addr.pedestrian ||
            addr.highway ||
            addr.street ||
            addr.footway ||
            addr.path;
        const houseNumber = addr.house_number;
        const suburb =
            addr.suburb ||
            addr.neighbourhood ||
            addr.city_district ||
            addr.quarter;
        const city =
            addr.city || addr.town || addr.municipality || addr.village;

        const parts: string[] = [];

        if (street) {
            parts.push(houseNumber ? `${street}, ${houseNumber}` : street);
        }

        if (suburb && suburb !== street) {
            parts.push(suburb);
        }

        if (city && city !== suburb && city !== street) {
            parts.push(city);
        }

        if (parts.length > 0) {
            return parts.join(" - ");
        }
    }

    if (data.display_name) {
        const segments = data.display_name.split(",").map((s) => s.trim());
        if (segments.length > 3) {
            return segments.slice(0, 3).join(", ");
        }
        return data.display_name;
    }

    return "Endereço não identificado";
}

async function executeReverseGeocode(item: GeocodeQueueItem): Promise<void> {
    const { stopId, lat, lon, cacheKey, selectionId } = item;

    try {
        const url = `${NOMINATIM_BASE_URL}?format=jsonv2&lat=${encodeURIComponent(
            lat
        )}&lon=${encodeURIComponent(
            lon
        )}&addressdetails=1&email=sigabem@recife.pe.gov.br`;

        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            },
        });

        if (!response.ok) {
            console.error(
                `Erro Nominatim para parada ${stopId}: HTTP ${response.status}`
            );
            const errorAddress: StopAddress = {
                status: "error",
                error: "Endereço indisponível",
                fetchedAt: Date.now(),
            };
            addressCache.set(cacheKey, errorAddress);
            notifyListeners(stopId, errorAddress, selectionId);
            return;
        }

        const data = await response.json();

        if (!data || data.error) {
            const errorAddress: StopAddress = {
                status: "error",
                error: "Endereço indisponível",
                fetchedAt: Date.now(),
            };
            addressCache.set(cacheKey, errorAddress);
            notifyListeners(stopId, errorAddress, selectionId);
            return;
        }

        const formatted = formatNominatimAddress(data);

        const successAddress: StopAddress = {
            status: "success",
            formattedAddress: formatted,
            displayName: data.display_name,
            fetchedAt: Date.now(),
        };

        addressCache.set(cacheKey, successAddress);
        notifyListeners(stopId, successAddress, selectionId);
    } catch (error) {
        console.error(`Falha na requisição Nominatim para parada ${stopId}:`, error);
        const errorAddress: StopAddress = {
            status: "error",
            error: "Endereço indisponível",
            fetchedAt: Date.now(),
        };
        addressCache.set(cacheKey, errorAddress);
        notifyListeners(stopId, errorAddress, selectionId);
    }
}

async function processQueue(): Promise<void> {
    if (isProcessingQueue) {
        return;
    }
    isProcessingQueue = true;

    try {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;

            // Garantir intervalo global de no mínimo MIN_REQUEST_INTERVAL_MS (>= 1s)
            const now = Date.now();
            const elapsed = now - lastRequestTimestamp;
            if (elapsed < MIN_REQUEST_INTERVAL_MS) {
                const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }

            lastRequestTimestamp = Date.now();
            await executeReverseGeocode(item);
        }
    } finally {
        isProcessingQueue = false;
    }
}

export function requestAddressesForStops(
    stops: Stop[],
    selectionId: number
): Record<string, StopAddress> {
    const snapshot: Record<string, StopAddress> = {};

    for (const stop of stops) {
        const cacheKey = getAddressCacheKey(
            stop.stopId,
            stop.stopLat,
            stop.stopLon
        );
        const cached = addressCache.get(cacheKey);

        if (cached) {
            snapshot[stop.stopId] = cached;
            // Se já está em sucesso, erro ou carregando, não reinsere na fila
            continue;
        }

        // Novo endereço: registrar como carregando e enfileirar
        const loadingEntry: StopAddress = {
            status: "loading",
        };
        addressCache.set(cacheKey, loadingEntry);
        snapshot[stop.stopId] = loadingEntry;

        queue.push({
            stopId: stop.stopId,
            lat: stop.stopLat,
            lon: stop.stopLon,
            cacheKey,
            selectionId,
        });
    }

    // Iniciar processamento da fila de forma assíncrona
    void processQueue();

    return snapshot;
}

export function cancelPendingLookupsForOldSelections(
    currentSelectionId: number,
    activeStopIds: Set<string>
): void {
    // Remove da fila pendências de seleções anteriores que não estão na seleção atual
    for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i];
        if (
            item.selectionId !== currentSelectionId &&
            !activeStopIds.has(item.stopId)
        ) {
            queue.splice(i, 1);
            // Remove do cache o estado "loading" transitório dessas paradas não consultadas
            // para que futuras consultas possam requisitá-las normalmente
            const currentCache = addressCache.get(item.cacheKey);
            if (currentCache && currentCache.status === "loading") {
                addressCache.delete(item.cacheKey);
            }
        }
    }
}

export function retryStopAddressLookup(
    stop: Stop,
    selectionId: number
): void {
    const cacheKey = getAddressCacheKey(
        stop.stopId,
        stop.stopLat,
        stop.stopLon
    );

    const currentCached = addressCache.get(cacheKey);
    // Se já estiver em loading, evita requisição duplicada
    if (currentCached && currentCached.status === "loading") {
        return;
    }

    const loadingEntry: StopAddress = {
        status: "loading",
    };
    addressCache.set(cacheKey, loadingEntry);
    notifyListeners(stop.stopId, loadingEntry, selectionId);

    // Adiciona na fila se não estiver presente
    const isAlreadyInQueue = queue.some((item) => item.cacheKey === cacheKey);
    if (!isAlreadyInQueue) {
        queue.push({
            stopId: stop.stopId,
            lat: stop.stopLat,
            lon: stop.stopLon,
            cacheKey,
            selectionId,
        });
    }

    void processQueue();
}
