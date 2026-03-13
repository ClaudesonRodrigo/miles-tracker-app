// src/core/services/flightApi.ts
import { KiwiApi, KiwiOptions } from "@ohm-vision/kiwi-tequila-api";

export interface FlightResult {
  airline: string;
  priceMiles: number;
}

export async function fetchFlightPrice(origin: string, destination: string, flightDate: string): Promise<FlightResult | null> {
  const apiKey = process.env.TEQUILA_API_KEY;

  // FALLBACK: Se ainda não tivermos a chave no .env, usamos o Mock (Simulação)
  if (!apiKey || apiKey === 'SUA_CHAVE_AQUI') {
    console.log(`[MOCK SDK] Simulação ativada para ${origin} -> ${destination} em ${flightDate}...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return {
      airline: ['LATAM', 'GOL', 'AZUL'][Math.floor(Math.random() * 3)],
      priceMiles: Math.floor(Math.random() * (40000 - 10000 + 1)) + 10000,
    };
  }

  // INTEGRAÇÃO REAL COM O SDK DA TEQUILA (KIWI)
  try {
    const options: KiwiOptions = { apiKey };
    const kiwi = new KiwiApi(options);

    // O SDK exige objetos do tipo Date
    const targetDate = new Date(flightDate);

    // Fazemos a busca "Single City" conforme a documentação do SDK
    const response = await kiwi.search.singlecity({
      fly_from: origin,
      fly_to: destination,
      date_from: targetDate,
      date_to: targetDate,
      flight_type: "oneway",
      curr: "BRL" // Força a moeda para Real (pode ser ajustado para formato milhas depois)
    });

    // Se não encontrar voos, retorna null
    if (!response.data || response.data.length === 0) {
      return null;
    }

    // Pega o voo mais barato (o primeiro da lista retornada)
    const cheapestFlight = response.data[0];

    // Mapeamento do nome da companhia (Kiwi retorna códigos de companhias aéreas)
    // Exemplo: LA = Latam, G3 = Gol, AD = Azul
    const airlineCode = cheapestFlight.airlines ? cheapestFlight.airlines[0] : 'Desconhecida';
    let airlineName = airlineCode;
    if (airlineCode === 'LA') airlineName = 'LATAM';
    if (airlineCode === 'G3') airlineName = 'GOL';
    if (airlineCode === 'AD') airlineName = 'AZUL';

    return {
      airline: airlineName,
      priceMiles: cheapestFlight.price // A Kiwi retorna em dinheiro (BRL), a nossa lógica pode precisar de converter isso para Milhas
    };

  } catch (error) {
    console.error(`[Flight API Error]: Erro ao procurar voo com SDK`, error);
    return null;
  }
}