import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFlightPrices } from '@/core/services/flightApi';

// Instância Admin para Bypass RLS (Cron não tem sessão de usuário)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🛠️ HELPER: Função de Sleep (Esfriamento de IP)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET() {
  try {
    console.log('--------------------------------------------------');
    console.log('🕒 [CRON JOB] Iniciando varredura de passagens...');

    // 1. Busca todos os alertas ativos no banco
    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from('alerts')
      .select('id, user_id, route_id, threshold_miles, routes(origin, destination, departure_date)')
      .eq('is_active', true);

    if (alertsError || !alerts || alerts.length === 0) {
      console.log('✅ [CRON JOB] Nenhum alerta ativo no momento.');
      return NextResponse.json({ success: true, message: "Nenhum alerta ativo." });
    }

    console.log(`📋 [CRON JOB] Encontrados ${alerts.length} alertas para processar.`);
    let notificationsSent = 0;

    // 🚀 GOLPE DE MESTRE: Serialização (For...of em vez de Promise.all)
    // Isso impede que a máquina abra 10 Chromes de uma vez e tome ban do WAF
    for (const [index, alert] of alerts.entries()) {
      // @ts-ignore
      const { origin, destination, departure_date } = alert.routes;

      console.log(`\n✈️ [ROTA ${index + 1}/${alerts.length}] ${origin} -> ${destination} (${departure_date})`);

      // Aciona o motor do Puppeteer (Um de cada vez!)
      const results = await fetchFlightPrices(origin, destination, departure_date);

      if (results && results.length > 0) {
        for (const res of results) {
          if (res.priceMiles <= alert.threshold_miles) {
            console.log(`🔥 [ALERTA ATINGIDO!] ${res.airline} está por ${res.priceMiles} milhas. (Alvo: ${alert.threshold_miles})`);
            
            // Grava a notificação no banco de dados
            await supabaseAdmin.from('notifications').insert([{
              user_id: alert.user_id,
              alert_id: alert.id,
              airline: res.airline,
              found_miles: res.priceMiles,
              is_read: false
            }]);
            
            notificationsSent++;
          } else {
             console.log(`❌ [FORA DO ALVO] ${res.airline} cobrando ${res.priceMiles} milhas (Alvo: ${alert.threshold_miles})`);
          }
        }
      }

      // 🧊 ESFRIAMENTO DE IP: Se não for a última rota, espera 3 segundos antes do próximo Chromium
      if (index < alerts.length - 1) {
        console.log(`🧊 [WAF BYPASS] Aguardando 3 segundos para não acionar bloqueio de rede...`);
        await delay(3000);
      }
    }

    console.log('--------------------------------------------------');
    return NextResponse.json({ 
      success: true, 
      message: `Varredura finalizada. ${alerts.length} rotas processadas. ${notificationsSent} notificações geradas.` 
    });

  } catch (error) {
    console.error('🔥 [CRON JOB ERROR]', error);
    return NextResponse.json({ success: false, error: 'Erro interno no processamento.' }, { status: 500 });
  }
}