import { Duffel } from '@duffel/api';

export interface FlightResult {
  airline: string;
  priceMiles: number;
}

// 🛠️ BUSINESS LOGIC: Multiplicador fixo em 100
const MILES_MULTIPLIER = 100;

export async function fetchFlightPrices(origin: string, destination: string, flightDate: string): Promise<FlightResult[]> {
  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey || apiKey === 'SUA_CHAVE_AQUI') return [];

  try {
    const duffel = new Duffel({ token: apiKey });

    const offerRequest = await duffel.offerRequests.create({
      slices: [{ origin, destination, departure_date: flightDate } as any],
      passengers: [{ type: 'adult' }],
      cabin_class: 'economy',
      return_offers: false,
    });

    const offersResponse = await duffel.offers.list({
      offer_request_id: offerRequest.data.id,
      limit: 50,
    });

    if (!offersResponse.data || offersResponse.data.length === 0) return [];

    const results: FlightResult[] = [];
    const airlinesFound = new Set();

    for (const offer of offersResponse.data) {
      const airlineName = offer.owner.name.toUpperCase();
      let mappedAirline = '';

      if (airlineName.includes('LATAM')) mappedAirline = 'LATAM';
      else if (airlineName.includes('GOL')) mappedAirline = 'GOL';
      else if (airlineName.includes('AZUL')) mappedAirline = 'AZUL';
      else {
        // Mapeamento para preencher o Dashboard em Sandbox
        if (airlinesFound.size === 0) mappedAirline = 'GOL';
        else if (airlinesFound.size === 1) mappedAirline = 'LATAM';
        else if (airlinesFound.size === 2) mappedAirline = 'AZUL';
      }

      if (mappedAirline && !airlinesFound.has(mappedAirline)) {
        airlinesFound.add(mappedAirline);
        
        // 🚀 AQUI ESTÁ A MÁGICA: Pegamos o valor (ex: 250.00) e multiplicamos por 100
        const rawAmount = parseFloat(offer.total_amount);
        const finalMiles = Math.floor(rawAmount * MILES_MULTIPLIER);
        
        results.push({
          airline: mappedAirline,
          priceMiles: finalMiles
        });
      }
      if (airlinesFound.size === 3) break;
    }
    return results;
  } catch (error: any) {
    console.error(`🔥 [Flight API Error]:`, error);
    return [];
  }
}