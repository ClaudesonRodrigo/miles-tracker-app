import { Duffel } from '@duffel/api';

export interface FlightResult {
  airline: string;
  priceMiles: number;
}

const MILES_MULTIPLIER = 100;
const SB_API_KEY = process.env.SCRAPINGBEE_API_KEY;

async function getScrapingBeeUrl(targetUrl: string, renderJs: boolean = false) {
  const url = new URL('https://app.scrapingbee.com/api/v1/');
  
  url.searchParams.set('api_key', SB_API_KEY || '');
  url.searchParams.set('url', targetUrl);
  url.searchParams.set('render_js', renderJs.toString());
  url.searchParams.set('country_code', 'br');
  url.searchParams.set('premium_proxy', 'true');
  
  return url.toString();
}

async function scrapeSmiles(origin: string, destination: string, flightDate: string): Promise<FlightResult | null> {
  try {
    const targetUrl = `https://api-air-flightsearch-prd.smiles.com.br/v1/flights?adults=1&cabinType=all&children=0&departureDate=${flightDate}&destinationAirportCode=${destination}&infants=0&isFlexibleDate=false&originAirportCode=${origin}&type=one_way`;
    const sbUrl = await getScrapingBeeUrl(targetUrl);
    
    const response = await fetch(sbUrl, {
      headers: {
        'x-api-key': 'a802226a-9fdc-4148-8921-7278052136e0',
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const flights = data.requestedFlightSegmentList?.[0]?.flightList;

    if (!flights || flights.length === 0) return null;

    const cheapestFlight = flights.reduce((prev: any, curr: any) => {
      const prevPrice = prev.cabinList[0].miles;
      const currPrice = curr.cabinList[0].miles;
      return prevPrice < currPrice ? prev : curr;
    });

    return {
      airline: 'GOL',
      priceMiles: cheapestFlight.cabinList[0].miles
    };
  } catch (error) {
    return null;
  }
}

async function scrapeAzul(origin: string, destination: string, flightDate: string): Promise<FlightResult | null> {
  try {
    const targetUrl = `https://www.voeazul.com.br/api/fsc/v1/search?origin=${origin}&destination=${destination}&date=${flightDate}&adults=1&children=0&infants=0&cabin=ECONOMY&isMiles=true`;
    const sbUrl = await getScrapingBeeUrl(targetUrl, true);

    const response = await fetch(sbUrl, { 
      next: { revalidate: 0 }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const flightOptions = data.outboundFlights;

    if (!flightOptions || flightOptions.length === 0) return null;

    const cheaper = flightOptions.reduce((prev: any, curr: any) => {
      return prev.bestPriceMiles < curr.bestPriceMiles ? prev : curr;
    });

    return {
      airline: 'AZUL',
      priceMiles: cheaper.bestPriceMiles
    };
  } catch (error) {
    return null;
  }
}

export async function fetchFlightPrices(origin: string, destination: string, flightDate: string): Promise<FlightResult[]> {
  const results: FlightResult[] = [];
  
  const [smilesData, azulData] = await Promise.all([
    scrapeSmiles(origin, destination, flightDate),
    scrapeAzul(origin, destination, flightDate)
  ]);

  if (smilesData) results.push(smilesData);
  if (azulData) results.push(azulData);

  if (results.length === 0) {
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

      if (offersResponse.data && offersResponse.data.length > 0) {
        const airlinesFound = new Set();
        for (const offer of offersResponse.data) {
          const airlineName = offer.owner.name.toUpperCase();
          let mappedAirline = '';
          if (airlineName.includes('LATAM')) mappedAirline = 'LATAM';
          else if (airlineName.includes('GOL')) mappedAirline = 'GOL';
          else if (airlineName.includes('AZUL')) mappedAirline = 'AZUL';

          if (mappedAirline && !airlinesFound.has(mappedAirline)) {
            airlinesFound.add(mappedAirline);
            const rawAmount = parseFloat(offer.total_amount);
            results.push({
              airline: mappedAirline,
              priceMiles: Math.floor(rawAmount * MILES_MULTIPLIER)
            });
          }
          if (airlinesFound.size === 3) break;
        }
      }
    } catch (error) {
      return [];
    }
  }

  return results;
}