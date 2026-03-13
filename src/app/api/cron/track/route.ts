// src/app/api/cron/track/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFlightPrices } from '../../../../core/services/flightApi'; // Caminho relativo seguro

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Instanciamos o Supabase com a Chave Mestra (Ignora RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    // 2. Procurar todos os alertas ativos e as suas rotas
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select(`
        id, 
        user_id, 
        threshold_miles,
        routes ( origin, destination, departure_date )
      `)
      .eq('is_active', true);

    if (alertsError) throw new Error(alertsError.message);
    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ message: 'Nenhum alerta ativo no momento.' });
    }

    let processedCount = 0;
    let notificationsSent = 0;

    // 3. O Loop do Robô: Para cada alerta, procura as 3 companhias
    for (const alert of alerts) {
      // @ts-ignore
      const { origin, destination, departure_date } = alert.routes;
      
      // O Cabo de Rede agora devolve uma matriz (Array) com GOL, LATAM e AZUL
      const flights = await fetchFlightPrices(origin, destination, departure_date);

      if (flights && flights.length > 0) {
        
        // Inner Loop: Processa cada companhia aérea individualmente
        for (const flight of flights) {
          
          // Gravar no Histórico de Preços (Série Temporal) para popular gráficos no futuro
          await supabase.from('price_history').insert([{
            alert_id: alert.id,
            airline: flight.airline,
            miles: flight.priceMiles
          }]);

          // A Regra de Negócio: O Alvo Global vs Companhia Específica
          if (flight.priceMiles < alert.threshold_miles) {
            await supabase.from('notifications').insert([{
              user_id: alert.user_id,
              alert_id: alert.id,
              airline: flight.airline,
              found_miles: flight.priceMiles,
              is_read: false
            }]);
            notificationsSent++;
          }
        }
        processedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Robô finalizou a varredura Tripla. ${processedCount} rotas processadas. ${notificationsSent} notificações geradas.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}