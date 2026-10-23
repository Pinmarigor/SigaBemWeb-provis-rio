// src/layers/StopLayer.tsx

import { useState, useEffect, useRef } from "react";
import { Circle, Marker, Popup, useMapEvents } from "react-leaflet";
import { fetchStops } from "../../../services/mapService";
import {
    requestAddressesForStops,
    cancelPendingLookupsForOldSelections,
    retryStopAddressLookup,
    subscribeToAddressUpdates,
} from "../../../services/geocodingService";
import { busStopIcon } from "../../../utils/mapUtils";
import { type Stop, type StopAddress } from "../../../types/map";

const isValidCoordinate = (lat: number, lon: number): boolean =>
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;

export default function StopLayer() {
    const [circleCenter, setCircleCenter] = useState<[number, number] | null>(null);
    const [stops, setStops] = useState<Stop[]>([]);
    const [addresses, setAddresses] = useState<Record<string, StopAddress>>({});
    const selectionIdRef = useRef<number>(0);

    // Ouve atualizações assíncronas e progressivas de endereços resolvidos
    useEffect(() => {
        const unsubscribe = subscribeToAddressUpdates((stopId, addressInfo) => {
            setAddresses((prev) => ({
                ...prev,
                [stopId]: addressInfo,
            }));
        });

        return unsubscribe;
    }, []);

    useMapEvents({
        click: async (e) => {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;

            if (!isValidCoordinate(lat, lon)) {
                return;
            }

            // setCircleCenter espera uma tupla [number, number] ou null
            setCircleCenter([lat, lon]);

            try {
                const data = await fetchStops(lat, lon, 300);
                setStops(data);

                // Nova seleção: incrementa o ID da rodada
                const newSelectionId = ++selectionIdRef.current;
                const activeIds = new Set(data.map((s) => s.stopId));

                // Cancela ou descarta da fila itens de seleções antigas fora da área visível atual
                cancelPendingLookupsForOldSelections(newSelectionId, activeIds);

                // Requisita os endereços para as paradas dentro do raio de 300m
                const initialAddresses = requestAddressesForStops(data, newSelectionId);
                setAddresses((prev) => ({
                    ...prev,
                    ...initialAddresses,
                }));
            } catch (error) {
                console.error("Erro ao carregar paradas próximas:", error);
                setStops([]);
            }
        },
    });

    const handleRetry = (stop: Stop) => {
        retryStopAddressLookup(stop, selectionIdRef.current);
    };

    return (
        <>
            {circleCenter && (
                <Circle
                    center={circleCenter}
                    radius={300} // Raio de 300 metros
                    pathOptions={{ color: "blue", fillOpacity: 0.2 }}
                />
            )}

            {stops
                .filter((stop) => isValidCoordinate(stop.stopLat, stop.stopLon))
                .map((stop) => {
                    const addressInfo = addresses[stop.stopId];

                    return (
                        <Marker
                            key={stop.stopId}
                            position={[stop.stopLat, stop.stopLon]}
                            icon={busStopIcon}
                        >
                            <Popup>
                                <div className="text-xs space-y-1.5 min-w-[200px]">
                                    <div>
                                        <span className="font-semibold text-sm text-gray-800">
                                            Nome: {stop.stopName}
                                        </span>
                                        <span className="text-gray-500 text-[11px] block">
                                            Código: {stop.stopId}
                                        </span>
                                    </div>
                                    <hr className="my-1 border-gray-200" />
                                    <div>
                                        <span className="font-medium text-gray-700 block mb-0.5">
                                            Endereço:
                                        </span>
                                        {(!addressInfo || addressInfo.status === "loading") && (
                                            <span className="text-gray-500 italic flex items-center gap-1.5">
                                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                                Buscando endereço...
                                            </span>
                                        )}
                                        {addressInfo?.status === "success" && (
                                            <span className="text-gray-800 block leading-snug">
                                                {addressInfo.formattedAddress}
                                            </span>
                                        )}
                                        {addressInfo?.status === "error" && (
                                            <div className="mt-0.5">
                                                <span className="text-red-500 block">
                                                    {addressInfo.error || "Endereço indisponível"}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRetry(stop);
                                                    }}
                                                    className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
                                                >
                                                    Tentar novamente
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
        </>
    );
}