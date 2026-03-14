import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFlightPrices } from '@/core/services/flightApi'; 
import { revalidatePath } from 'next/cache'; // Importamos o destruidor de cache

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
      // @ts-ignore
      const { origin, destination, departure_date } = alert.routes;
      
      console.log(`🌍 [Robô] Iniciando varredura para a rota ${origin} -> ${destination}...`);
      const flights = await fetchFlightPrices(origin, destination, departure_date);

      if (flights && flights.length > 0) {
        
        // Memória blindada (Evita nulls do banco de dados)
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

        // STATE SYNCHRONIZATION: Atualiza o Cartão Principal
        const { error: updateError } = await supabase.from('alerts').update({
          miles_gol: newGol,
          miles_latam: newLatam,
          miles_azul: newAzul
        }).eq('id', alert.id);

        if (updateError) {
          console.error(`❌ [Erro no Supabase] Falha ao atualizar as milhas no cartão:`, updateError);
        } else {
          console.log(`✅ [Sucesso] Valores enviados ao banco -> GOL: ${newGol} | LATAM: ${newLatam} | AZUL: ${newAzul}`);
        }

        processedCount++;
      }
    }

    // PURGA DE CACHE: Obriga o Painel a desenhar a tela de novo!
    revalidatePath('/dashboard');

    return NextResponse.json({ 
      success: true, 
      message: `Robô finalizou a varredura Tripla. ${processedCount} rotas processadas. ${notificationsSent} notificações geradas.` 
    });

  } catch (error: any) {
    console.error(`🔥 [Erro Crítico no Robô]`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}