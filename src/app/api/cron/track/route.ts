import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFlightPrices } from '@/core/services/flightApi'; 
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select(`
        id, 
        user_id, 
        threshold_miles,
        miles_gol,
        miles_latam,
        miles_azul,
        routes ( origin, destination, departure_date )
      `)
      .eq('is_active', true);

    if (alertsError) throw new Error(alertsError.message);
    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ message: 'Nenhum alerta ativo no momento.' });
    }

    let processedCount = 0;
    let notificationsSent = 0;

    for (const alert of alerts) {
      const { origin, destination, departure_date } = alert.routes as any;
      const flights = await fetchFlightPrices(origin, destination, departure_date);

      if (flights && flights.length > 0) {
        let newGol = alert.miles_gol || 0;
        let newLatam = alert.miles_latam || 0;
        let newAzul = alert.miles_azul || 0;

        for (const flight of flights) {
          if (flight.airline === 'GOL') newGol = flight.priceMiles;
          if (flight.airline === 'LATAM') newLatam = flight.priceMiles;
          if (flight.airline === 'AZUL') newAzul = flight.priceMiles;

          await supabase.from('price_history').insert([{
            alert_id: alert.id,
            airline: flight.airline,
            miles: flight.priceMiles
          }]);

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

        await supabase.from('alerts').update({
          miles_gol: newGol,
          miles_latam: newLatam,
          miles_azul: newAzul
        }).eq('id', alert.id);

        processedCount++;
      }
    }

    revalidatePath('/dashboard');

    return NextResponse.json({ 
      success: true, 
      message: `Robô finalizou a varredura. ${processedCount} rotas processadas. ${notificationsSent} notificações geradas.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}