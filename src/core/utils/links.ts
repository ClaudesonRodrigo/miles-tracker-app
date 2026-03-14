export function getAirlineBookingLink(airline: string, origin: string, destination: string, date: string) {
  const formattedDate = date.split('-').reverse().join('/'); // Converte YYYY-MM-DD para DD/MM/YYYY
  
  const links: Record<string, string> = {
    'GOL': `https://www.voegol.com.br/pt-br/busca-vendas?origem=${origin}&destino=${destination}&dataPartida=${formattedDate}&adultos=1`,
    'LATAM': `https://www.latamairlines.com/br/pt/ofertas-voos?origin=${origin}&destination=${destination}&inbound=null&outbound=${date}&adults=1&children=0&infants=0&cabin=economy&trip=OW`,
    'AZUL': `https://www.voeazul.com.br/br/pt/home/selecao-voo?origin=${origin}&destination=${destination}&date=${date}&passengers=1`
  };

  return links[airline.toUpperCase()] || 'https://www.google.com/travel/flights';
}