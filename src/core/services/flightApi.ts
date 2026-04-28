export interface FlightSearchConfig {
  origin: string;
  destination: string;
  departureDate: string; // Formato esperado: YYYY-MM-DD
}

// 🛡️ Tipagem para agradar o TypeScript e o VS Code
interface SerpApiFlight {
  flights: Array<{ airline?: string }>;
  price?: number;
}

export async function searchFlights({ origin, destination, departureDate }: FlightSearchConfig) {
  try {
    console.log(`[SERPAPI] Buscando voos reais de ${origin} para ${destination} em ${departureDate}...`);

    if (!process.env.SERPAPI_API_KEY) {
      throw new Error('A variável de ambiente SERPAPI_API_KEY não está definida no seu .env');
    }

    // Configuração dos parâmetros exigidos pelo Google Flights
    const params = new URLSearchParams({
      engine: 'google_flights',
      departure_id: origin,
      arrival_id: destination,
      outbound_date: departureDate,
      currency: 'BRL',      // Forçar o preço em Reais
      hl: 'pt',             // Idioma em português
      type: '2',            // 2 = Voo apenas de ida
      api_key: process.env.SERPAPI_API_KEY
    });

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    const data = await response.json();

    if (data.error) {
      console.error('[SERPAPI] Erro retornado pela API:', data.error);
      return [];
    }

    // O Google Flights divide os resultados e nós juntamos tudo num array tipado
    const allFlights: SerpApiFlight[] = [
      ...(data.best_flights || []),
      ...(data.other_flights || [])
    ];

    console.log(`[SERPAPI] Sucesso! ${allFlights.length} ofertas encontradas no Google Flights.`);

    // 🛡️ Agora o map sabe exatamente o que é "flight" sem usar "any"
    return allFlights.map((flight) => {
      return {
        owner: {
          // Extrai o nome da companhia do primeiro trajeto
          name: flight.flights?.[0]?.airline || 'DESCONHECIDA'
        },
        // Converte o preço para string para manter o padrão que a rota espera
        total_amount: flight.price?.toString() || '999999'
      };
    });

  } catch (error) {
    console.error('[SERPAPI] Erro crítico ao buscar passagens:', error);
    // Retorna um array vazio para não quebrar a aplicação
    return [];
  }
}