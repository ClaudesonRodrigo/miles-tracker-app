export function getAirlineBookingLink(airline: string, origin: string, destination: string, date: string) {
  // 🛡️ Se faltar algum dado, retorna para a home padrão ou vazio
  if (!origin || !destination || !date) return '#';

  const formattedDate = date.split('-').reverse().join('/'); // Converte YYYY-MM-DD para DD/MM/YYYY
  
  const links: Record<string, string> = {
    'GOL': `https://www.voegol.com.br/pt-br/busca-vendas?origem=${origin}&destino=${destination}&dataPartida=${formattedDate}&adultos=1`,
    'LATAM': `https://www.latamairlines.com/br/pt/ofertas-voos?origin=${origin}&destination=${destination}&inbound=null&outbound=${date}&adults=1&children=0&infants=0&cabin=economy&trip=OW`,
    'AZUL': `https://www.voeazul.com.br/br/pt/home/selecao-voo?origin=${origin}&destination=${destination}&date=${date}&passengers=1`
  };

  // ✈️ Fallback oficial do Google Flights com a busca já preenchida!
  const fallbackGoogle = `https://www.google.com/travel/flights?q=Flights%20to%20${destination}%20from%20${origin}%20on%20${date}%20oneway`;

  return links[airline.toUpperCase()] || fallbackGoogle;
}