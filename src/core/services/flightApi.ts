import { createClient } from '@supabase/supabase-js';

export interface FlightResult {
  airline: string;
  priceMiles: number;
}

const SB_API_KEY = process.env.SCRAPINGBEE_API_KEY;
const SMILES_API_KEY = process.env.SMILES_API_KEY;

// 🛠️ HELPER: Cliente Supabase para o Servidor (Service Role para bypassar RLS no Cache)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ⏱️ FinOps: Tempo de vida do Cache em milissegundos (3 horas)
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

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
        'x-api-key': SMILES_API_KEY || '',
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
  const airlinesToScrape = ['GOL', 'AZUL'];
  
  // 1. ESTRATÉGIA DE CACHE: Tenta ler do Supabase primeiro
  const { data: cachedData, error: cacheError } = await supabase
    .from('flight_cache')
    .select('*')
    .eq('origin', origin)
    .eq('destination', destination)
    .eq('departure_date', flightDate);

  const now = new Date().getTime();
  const validCache: FlightResult[] = [];

  if (cachedData && !cacheError) {
    for (const cache of cachedData) {
      const cacheAge = now - new Date(cache.created_at).getTime();
      if (cacheAge < CACHE_TTL_MS) {
        // Cache Válido! Adiciona aos resultados e remove da fila de scraping
        console.log(`🟢 [CACHE HIT] ${origin} -> ${destination} | ${cache.airline} encontrada no banco local.`);
        validCache.push({ airline: cache.airline, priceMiles: cache.price_miles });
        const index = airlinesToScrape.indexOf(cache.airline);
        if (index > -1) airlinesToScrape.splice(index, 1);
      } else {
        console.log(`🟡 [CACHE EXPIRED] ${origin} -> ${destination} | ${cache.airline} passou de 3 horas. Revalidando...`);
      }
    }
  }

  results.push(...validCache);

  // Se todas as companhias estavam no cache, retornamos agora. Custo zero!
  if (airlinesToScrape.length === 0) {
    console.log(`⚡ [FAST RETURN] Todos os dados em cache. Nenhum crédito consumido.`);
    return results;
  }

  // 2. SCRAPING PARALELO APENAS DAS FALTANTES
  console.log(`🔴 [SCRAPING] Consultando API externa via ScrapingBee para: ${airlinesToScrape.join(', ')}`);
  const scrapingPromises = [];
  
  if (airlinesToScrape.includes('GOL')) {
    scrapingPromises.push(scrapeSmiles(origin, destination, flightDate));
  }
  if (airlinesToScrape.includes('AZUL')) {
    scrapingPromises.push(scrapeAzul(origin, destination, flightDate));
  }

  const freshData = await Promise.all(scrapingPromises);
  
  // 3. PERSISTÊNCIA: Salva os dados novos no banco para as próximas buscas
  const cacheInserts = [];
  for (const data of freshData) {
    if (data) {
      results.push(data);
      cacheInserts.push({
        origin,
        destination,
        departure_date: flightDate,
        airline: data.airline,
        price_miles: data.priceMiles,
        created_at: new Date().toISOString()
      });
    }
  }

  if (cacheInserts.length > 0) {
    console.log(`💾 [CACHE SALVO] Inserindo ${cacheInserts.length} novos registros no Supabase para ${origin} -> ${destination}.`);
    await supabase
      .from('flight_cache')
      .upsert(cacheInserts, { onConflict: 'origin,destination,departure_date,airline' });
  }

  return results;
}