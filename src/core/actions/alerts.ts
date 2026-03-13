'use server';

import { supabase } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';

export async function createMilesAlert(formData: FormData) {
  try {
    const origin = formData.get('origin') as string;
    const destination = formData.get('destination') as string;
    const departureDate = formData.get('departureDate') as string;
    const thresholdMiles = Number(formData.get('thresholdMiles'));

    if (!origin || !destination || !departureDate || !thresholdMiles) {
      return { success: false, message: 'Preencha todos os campos obrigatórios.' };
    }

    // 1. Verificar Autenticação do Lead (Usuário)
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      return { success: false, message: 'Lead não autenticado. Faça login para criar seu alerta.' };
    }

    const userId = authData.user.id;

    // 2. Criar a Rota no banco de dados (Origem, Destino e Data)
    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert([
        { 
          origin: origin.toUpperCase(), 
          destination: destination.toUpperCase(), 
          departure_date: departureDate 
        }
      ])
      .select('id')
      .single();

    if (routeError) {
      return { success: false, message: `Erro na rota: ${routeError.message}` };
    }

    // 3. Criar o Alerta (Regra de Negócio principal do SaaS)
    const { error: alertError } = await supabase
      .from('alerts')
      .insert([
        {
          user_id: userId,
          route_id: routeData.id,
          threshold_miles: thresholdMiles,
          is_active: true
        }
      ]);

    if (alertError) {
      return { success: false, message: `Erro no alerta: ${alertError.message}` };
    }

    // 4. Limpar o cache do Next.js para atualizar o Dashboard instantaneamente
    revalidatePath('/dashboard');

    return { success: true, message: 'Alerta ativado! Monitorando Latam, Gol e Azul.' };

  } catch (error: any) {
    return { success: false, message: error.message || 'Falha catastrófica no servidor.' };
  }
}