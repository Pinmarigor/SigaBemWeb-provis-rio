// src/features/map/components/MapHome.tsx
import { useState } from "react";
import BaseMap from "./BaseMap";
import FiltersContainer from './FiltersContainer'; 
import StopLayer from '../layers/StopLayer'; 
import PcdLayer from '../layers/PcdLayer'; 
import GpsLayer from '../layers/GpsLayer';
import LayerItem from "../layers/LayerItem";
import FilterButton from "./FilterButton";

import { type DadosFiltro } from "../../../types/map";

export default function MapHome() {
  const [pcdFilter, setPcdFilter] = useState<DadosFiltro>({ 
    minAge: 0, 
    maxAge: 100,
    gender: "",
    disability: "",
    city: "",
    neighborhood: "",
  });
  const [activeForm, setActiveForm] = useState<"people" | "stops">("people");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getData = (filter: DadosFiltro) => {
    setPcdFilter(filter);
    // On mobile, close the sidebar after searching
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full overflow-hidden relative">
      {/* Sidebar Toggle for Mobile */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden absolute top-25 left-4 z-[1000] bg-white p-2 rounded-md shadow-md font-bold text-brand-dark-green"
      >
        {isSidebarOpen ? "Fechar Filtros" : "Abrir Filtros"}
      </button>

      {/* Sidebar (Aside) */}
      <aside 
        className={`
          flex flex-col w-full h-full p-5 bg-white z-[1000] transition-all duration-300
          md:relative md:translate-x-0 md:max-w-[320px] lg:max-w-[400px]
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          absolute inset-0 md:static
        `}
      >
        <div className="flex items-center justify-center gap-2 w-full mb-4 mt-12 md:mt-0">
          <FilterButton 
            isActive={activeForm === "people"}
            onClick={() => setActiveForm("people")}
            label="Filtrar Pessoas" 
          />
          <FilterButton 
            isActive={activeForm === "stops"}
            onClick={() => setActiveForm("stops")}
            label="Filtrar Paradas" 
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <FiltersContainer onSubmitDados={getData} activeForm={activeForm}/> 
        </div>
      </aside>

      {/* Map Area */}
      <main className="flex-1 h-full relative"> 
        <BaseMap>
          <LayerItem label="Paradas" layer={<StopLayer />}/>
          <LayerItem label="PCDs" layer={<PcdLayer dadosFiltro={pcdFilter} />}/>
          <LayerItem label="Ônibus" layer={<GpsLayer />}/>
        </BaseMap>
      </main>
    </div>
  );
}
