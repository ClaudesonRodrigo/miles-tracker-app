import { createClient } from '@supabase/supabase-js';

export interface FlightResult {
  airline: string;
  priceMiles: number;
}

// 🛠️ HELPER: Cliente Supabase para o Servidor
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

// 🎯 MOTOR B2B: Integração Limpa via API (Atualmente com Mock para desenvolvimento UI)
async function fetchFromB2bApi(origin: string, destination: string, flightDate: string): Promise<FlightResult | null> {
  try {
    console.log(`🔌 [API GATEWAY] Conectando ao provedor B2B para a rota ${origin} -> ${destination} em ${flightDate}...`);

    // Simulação de latência de rede de uma API real (ex: HubMilhas)
    await new Promise(resolve => setTimeout(resolve, 800));

    // TODO: Quando assinar uma API oficial, descomente e use este bloco:
    /*
    const response = await fetch(`https://api.fornecedor.com/v1/flights?orig=${origin}&dest=${destination}&date=${flightDate}`, {
      headers: { 'Authorization': `Bearer ${process.env.B2B_API_TOKEN}` }
    });
    const data = await response.json();
    return { airline: 'GOL', priceMiles: data.bestPrice };
    */

    // MOCK DATA: Gerando um preço aleatório realista entre 15.000 e 45.000 milhas para renderizar o Front-end
    const mockPrice = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;

    console.log(`✅ [B2B SUCCESS] Resposta recebida do provedor oficial: ${mockPrice} milhas!`);
    
    return { airline: 'GOL', priceMiles: mockPrice };

  } catch (error: any) {
    console.error(`❌ [API Gateway Error] Falha de comunicação com o provedor B2B:`, error.message);
    return null;
  }
}

export async function fetchFlightPrices(origin: string, destination: string, flightDate: string): Promise<FlightResult[]> {
  const results: FlightResult[] = [];
  const airlinesToFetch = ['GOL']; 
  
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
        console.log(`🟢 [CACHE HIT] Dados lidos da memória do Supabase (Zero custo).`);
        validCache.push({ airline: cache.airline, priceMiles: cache.price_miles });
        const index = airlinesToFetch.indexOf(cache.airline);
        if (index > -1) airlinesToFetch.splice(index, 1);
      }
    }
  }

  results.push(...validCache);

  if (airlinesToFetch.length === 0) return results;

  if (airlinesToFetch.includes('GOL')) {
    const freshData = await fetchFromB2bApi(origin, destination, flightDate);
    if (freshData) {
      results.push(freshData);
      await supabase.from('flight_cache').upsert({
        origin, destination, departure_date: flightDate, airline: freshData.airline,
        price_miles: freshData.priceMiles, created_at: new Date().toISOString()
      }, { onConflict: 'origin,destination,departure_date,airline' });
    }
  }

  return results;
}