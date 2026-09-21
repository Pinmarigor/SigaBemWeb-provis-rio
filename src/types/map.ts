import { neighborhoodsByCity } from "../constants/neighborhoods";

export interface Stop {
    stopId: string;
    stopName: string;
    stopLat: number;
    stopLon: number;
}

export interface Pcd {
    pcd_id: string;
    age: number;
    gender: string;
    disability_type: string;
    license_type: string;
    residence: { latitude: number; longitude: number };
}

export interface Bus {
    bus_id: string;
    latitude: number;
    longitude: number;
    velocidade?: number;
    trip_headsign?: string;
    recorded_at?: string;
    distance?: number;
}

export interface BusNearbyResponse {
    success: boolean;
    buses: Bus[];
    lastUpdate?: string;
}

export interface DadosFiltro {
    minAge: number;
    maxAge: number;
    gender: string;
    disability: string; 
    city: string;
    neighborhood: string;
}

export type CityKey = keyof typeof neighborhoodsByCity;

export type Neighborhood = (typeof neighborhoodsByCity)[CityKey][number];

export type StopsFilter = {
  city: CityKey;
  neighborhood: Neighborhood;
};
