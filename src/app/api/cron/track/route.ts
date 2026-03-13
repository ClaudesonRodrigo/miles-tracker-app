// src/app/api/cron/track/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFlightPrice } from '../../../../core/services/flightApi';

// Forçamos esta rota a ser dinâmica (não usar cache antigo)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Instanciamos o Supabase com a Chave Mestra (Ignora RLS)
    // Usamos o cliente padrão do supabase-js porque não há sessão/cookies aqui
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

    // 3. O Loop do Robô: Para cada alerta, procurar o preço
    for (const alert of alerts) {
      // @ts-ignore - Tipagem do JOIN do Supabase
      const { origin, destination, departure_date } = alert.routes;
      
      const flightData = await fetchFlightPrice(origin, destination, departure_date);

      if (flightData) {
        // Gravar no Histórico de Preços (Série Temporal)
        await supabase.from('price_history').insert([{
          alert_id: alert.id,
          airline: flightData.airline,
          miles: flightData.priceMiles
        }]);

        // Regra de Negócio: O Efeito Instagram (Notificação)
        if (flightData.priceMiles < alert.threshold_miles) {
          await supabase.from('notifications').insert([{
            user_id: alert.user_id,
            alert_id: alert.id,
            airline: flightData.airline,
            found_miles: flightData.priceMiles,
            is_read: false // O "pontinho vermelho" fica aceso
          }]);
        }
        processedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Robô finalizou a varredura. ${processedCount} alertas processados.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}