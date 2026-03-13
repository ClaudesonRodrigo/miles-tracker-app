// src/core/services/flightApi.ts
import { KiwiApi, KiwiOptions } from "@ohm-vision/kiwi-tequila-api";

export interface FlightResult {
  airline: string;
  priceMiles: number;
}

// O motor agora devolve um Array (lista) com os voos encontrados
export async function fetchFlightPrices(origin: string, destination: string, flightDate: string): Promise<FlightResult[]> {
  const apiKey = process.env.TEQUILA_API_KEY;

  // FALLBACK: O nosso Mock agora gera os 3 preços em simultâneo (Modo Triplo)
  if (!apiKey || apiKey === 'SUA_CHAVE_AQUI') {
    console.log(`[MOCK TRIPLO] A varrer GOL, LATAM e AZUL para ${origin} -> ${destination} em ${flightDate}...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return [
      { airline: 'GOL', priceMiles: Math.floor(Math.random() * (40000 - 10000 + 1)) + 10000 },
      { airline: 'LATAM', priceMiles: Math.floor(Math.random() * (40000 - 10000 + 1)) + 10000 },
      { airline: 'AZUL', priceMiles: Math.floor(Math.random() * (40000 - 10000 + 1)) + 10000 }
    ];
  }

  // INTEGRAÇÃO REAL COM O SDK DA TEQUILA (KIWI)
  try {
    const options: KiwiOptions = { apiKey };
    const kiwi = new KiwiApi(options);
    const targetDate = new Date(flightDate);

    const response = await kiwi.search.singlecity({
      fly_from: origin,
      fly_to: destination,
      date_from: targetDate,
      date_to: targetDate,
      flight_type: "oneway",
      curr: "BRL" 
    });

    if (!response.data || response.data.length === 0) {
      return [];
    }

    // Numa integração real, nós iríamos mapear a lista devolvida pela Kiwi e filtrar a melhor oferta de cada companhia.
    // Para simplificar a fundação agora, pegamos apenas no primeiro resultado.
    const cheapestFlight = response.data[0];
    const airlineCode = cheapestFlight.airlines ? cheapestFlight.airlines[0] : 'Desconhecida';
    let airlineName = airlineCode;
    if (airlineCode === 'LA') airlineName = 'LATAM';
    if (airlineCode === 'G3') airlineName = 'GOL';
    if (airlineCode === 'AD') airlineName = 'AZUL';

    return [{
      airline: airlineName,
      priceMiles: cheapestFlight.price 
    }];

  } catch (error) {
    console.error(`[Flight API Error]: Erro ao procurar voos com SDK`, error);
    return [];
  }
}