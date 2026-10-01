import { useEffect, useRef, useState } from "react";
import { Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { fetchBuses } from "../../../services/mapService";
import type { Bus } from "../../../types/map";

const createBusIcon = (bus: Bus) => {
    const speedHtml = bus.velocidade !== undefined
        ? `<div class="text-[10px] opacity-90">${bus.velocidade} km/h</div>`
        : '';

    const htmlContent = `
        <div class="bg-red-600 text-white font-bold text-xs rounded shadow-md px-2 py-1 text-center border border-red-800 whitespace-nowrap relative">
            <div>${bus.bus_id}</div>
            ${speedHtml}
            <div class="absolute w-2 h-2 bg-red-600 rotate-45 -bottom-1 left-1/2 transform -translate-x-1/2 border-r border-b border-red-800"></div>
        </div>
    `;

    return L.divIcon({
        html: htmlContent,
        className: 'custom-bus-icon-container',
        iconSize: [70, 42],
        iconAnchor: [35, 42],
    });
};


export default function GpsLayer() {
    const map = useMap();
    const [buses, setBuses] = useState<Bus[]>([]);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        const loadBuses = async () => {
            const center = map.getCenter();
            console.log(`[GPS] Buscando módulos em: ${center.lat}, ${center.lng}`);

            const data = await fetchBuses(center.lat, center.lng, 10000);

            if (data) {
                console.log(`[GPS] Módulos encontrados: ${data.length}`);

                if (data.length > 0) {
                    data.forEach((b: Bus) => {
                        console.log(`[GPS] Atualizando módulo: #${b.bus_id}`);
                    });
                }

                setBuses(data);
            }
        };

        // Carrega imediatamente ao montar
        loadBuses();

        // Configura o polling a cada 10 segundos
        intervalRef.current = window.setInterval(loadBuses, 10000);

        return () => {
            if (intervalRef.current !== null) {
                window.clearInterval(intervalRef.current);
            }
        };
    }, [map]); // Dependência no map para caso ele mude (raro), mas garante funcionamento correto

    return (
        <>
            {buses.map((bus) => (
                <Marker
                    key={bus.bus_id}
                    position={[bus.latitude, bus.longitude]}
                    icon={createBusIcon(bus)}
                >
                    <Tooltip direction="top" offset={[0, -42]} opacity={1}>
                        <div className="text-sm">
                            <strong>bus_id:</strong> {bus.bus_id} <br />
                            <strong>linha:</strong> {bus.trip_headsign} <br />
                            {bus.velocidade !== undefined && (
                                <><strong>Velocidade:</strong> {bus.velocidade} km/h <br /></>
                            )}
                            <strong>Latitude:</strong> {bus.latitude.toFixed(6)} <br />
                            <strong>Longitude:</strong> {bus.longitude.toFixed(6)}
                        </div>
                    </Tooltip>
                    <Popup>
                        <strong>Módulo:</strong> #{bus.bus_id} <br />
                        {bus.velocidade !== undefined && (
                            <><strong>Velocidade:</strong> {bus.velocidade} km/h <br /></>
                        )}
                        {bus.trip_headsign && (
                            <><strong>Destino:</strong> {bus.trip_headsign} <br /></>
                        )}
                        {bus.distance !== undefined && (
                            <><strong>Distância:</strong> {bus.distance} km <br /></>
                        )}
                        {bus.recorded_at && (
                            <><strong>Última atualização:</strong> {bus.recorded_at} <br /></>
                        )}
                    </Popup>
                </Marker>
            ))}
        </>
    );
}
