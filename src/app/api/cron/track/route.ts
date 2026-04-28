import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchFlights } from '@/core/services/flightApi';
import { sendTelegramMessage } from '@/core/services/telegramService';

// Instância Admin para Bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET() {
  try {
    console.log('--------------------------------------------------');
    console.log('🕒 [CRON JOB] Iniciando varredura de passagens (FIAT/BRL)...');

    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from('alerts')
      .select('id, user_id, route_id, threshold_price, last_notified, routes(origin, destination, departure_date)')
      .eq('is_active', true);

    if (alertsError || !alerts || alerts.length === 0) {
      console.log('✅ [CRON JOB] Nenhum alerta ativo no momento.');
      return NextResponse.json({ success: true, message: "Nenhum alerta ativo." });
    }

    console.log(`📋 [CRON JOB] Encontrados ${alerts.length} alertas para processar.`);
    let notificationsSent = 0;

    for (const [index, alert] of alerts.entries()) {
      const routesData = Array.isArray(alert.routes) ? alert.routes[0] : alert.routes;
      const { origin, destination, departure_date } = routesData as unknown as { 
        origin: string; 
        destination: string; 
        departure_date: string 
      };

      console.log(`\n✈️ [ROTA ${index + 1}/${alerts.length}] ${origin} -> ${destination} (${departure_date})`);

      const lastNotified = alert.last_notified ? new Date(alert.last_notified).getTime() : 0;
      const now = new Date().getTime();
      const horasDesdeUltimaNotificacao = (now - lastNotified) / (1000 * 60 * 60);

      const results = await searchFlights({
        origin: origin,
        destination: destination,
        departureDate: departure_date
      });

      if (results && results.length > 0) {
        
        // 🛡️ PROTEÇÃO DO BANCO: Agrupar pelo menor preço de cada companhia aérea
        const lowestPrices: Record<string, { airline: string, price: number }> = {};

        for (const res of results) {
          const airlineName = res.owner?.name?.toUpperCase() || 'DESCONHECIDA';
          const priceFiat = parseFloat(res.total_amount);

          if (!lowestPrices[airlineName] || priceFiat < lowestPrices[airlineName].price) {
            lowestPrices[airlineName] = { airline: airlineName, price: priceFiat };
          }
        }

        // Converte o objeto de volta para um array apenas com os campeões de preço
        const bestOffers = Object.values(lowestPrices);
        console.log(`[FILTRO] ${results.length} resultados reduzidos para as ${bestOffers.length} melhores ofertas únicas.`);

        const updatePayload: Record<string, number | string> = {};

        // Agora iteramos apenas nas melhores ofertas (no máximo 1 por companhia)
        for (const offer of bestOffers) {
          
          if (offer.airline.includes('GOL')) updatePayload.price_gol = offer.price;
          if (offer.airline.includes('LATAM')) updatePayload.price_latam = offer.price;
          if (offer.airline.includes('AZUL')) updatePayload.price_azul = offer.price;

          if (offer.price <= alert.threshold_price) {
            console.log(`🔥 [ALERTA ATINGIDO!] ${offer.airline} está por R$ ${offer.price.toFixed(2)}. (Alvo: R$ ${alert.threshold_price})`);
            
            await supabaseAdmin.from('notifications').insert([{
              user_id: alert.user_id,
              alert_id: alert.id,
              airline: offer.airline,
              found_price: offer.price,
              is_read: false
            }]);
            
            if (horasDesdeUltimaNotificacao >= 12 || lastNotified === 0) {
                const mensagemAlert = `🔥 <b>OPORTUNIDADE ENCONTRADA</b> 🔥\n\n✈️ <b>Trecho:</b> ${origin} ➔ ${destination}\n📅 <b>Data:</b> ${departure_date}\n🏢 <b>Companhia:</b> ${offer.airline}\n\n💰 <b>Preço Atual:</b> R$ ${offer.price.toFixed(2)}\n🎯 <b>Seu Alvo:</b> R$ ${alert.threshold_price.toFixed(2)}\n\n🏃‍♂️ <i>Corra para o painel e emita agora!</i>`;
                
                const sucesso = await sendTelegramMessage(mensagemAlert);
                
                if (sucesso) {
                    notificationsSent++;
                    updatePayload.last_notified = new Date().toISOString(); 
                }
            } else {
                console.log(`⏳ [TELEGRAM IGNORADO] Alerta já disparado nas últimas 12h.`);
            }

          } else {
             console.log(`❌ [FORA DO ALVO] ${offer.airline} cobrando R$ ${offer.price.toFixed(2)}`);
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('alerts')
            .update(updatePayload)
            .eq('id', alert.id);

          if (updateError) {
             console.error(`🔥 [DB UPDATE ERROR] Falha no Supabase:`, updateError.message);
          } else {
             console.log(`✅ [DB UPDATE SUCESSO] Valores gravados:`, updatePayload);
          }
        }
      }

      if (index < alerts.length - 1) {
        await delay(3000);
      }
    }

    console.log('--------------------------------------------------');
    return NextResponse.json({ 
      success: true, 
      message: `Varredura finalizada. ${alerts.length} rotas. ${notificationsSent} notificações geradas.` 
    });

  } catch (error) {
    console.error('🔥 [CRON JOB ERROR]', error);
    return NextResponse.json({ success: false, error: 'Erro interno no processamento.' }, { status: 500 });
  }
}