'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Helper interno para instanciar o Supabase (DRY)
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Ignorado em Server Actions
          }
        },
      },
    }
  );
}

// 1. CREATE (Criar Alerta com Granularidade Tripla)
export async function createMilesAlert(formData: FormData) {
  try {
    const passengerName = formData.get('passengerName') as string;
    const origin = formData.get('origin') as string;
    const destination = formData.get('destination') as string;
    const departureDate = formData.get('departureDate') as string;
    const thresholdMiles = Number(formData.get('thresholdMiles'));
    
    // Captura individual das companhias aéreas
    const milesGol = Number(formData.get('milesGol')) || 0;
    const milesLatam = Number(formData.get('milesLatam')) || 0;
    const milesAzul = Number(formData.get('milesAzul')) || 0;

    if (!passengerName || !origin || !destination || !departureDate || !thresholdMiles) {
      return { success: false, message: 'Preencha todos os campos obrigatórios principais.' };
    }

    const supabase = await getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      return { success: false, message: 'Lead não autenticado.' };
    }

    const userId = authData.user.id;

    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert([{ origin: origin.toUpperCase(), destination: destination.toUpperCase(), departure_date: departureDate }])
      .select('id')
      .single();

    if (routeError) return { success: false, message: `Erro na rota: ${routeError.message}` };

    // Inserção com a nova estrutura da Base de Dados
    const { error: alertError } = await supabase
      .from('alerts')
      .insert([{
        user_id: userId,
        route_id: routeData.id,
        passenger_name: passengerName,
        miles_gol: milesGol,
        miles_latam: milesLatam,
        miles_azul: milesAzul,
        threshold_miles: thresholdMiles,
        is_active: true
      }]);

    if (alertError) return { success: false, message: `Erro no alerta: ${alertError.message}` };

    revalidatePath('/dashboard');
    return { success: true, message: 'Rastreador Triplo ativado!' };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 2. UPDATE (Pausar ou Retomar Alerta)
export async function toggleAlertStatus(formData: FormData) {
  try {
    const alertId = formData.get('alertId') as string;
    const currentStatus = formData.get('isActive') === 'true';

    if (!alertId) return { success: false, message: 'ID não encontrado.' };

    const supabase = await getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData?.user) return { success: false, message: 'Não autorizado.' };

    const { error } = await supabase
      .from('alerts')
      .update({ is_active: !currentStatus })
      .eq('id', alertId)
      .eq('user_id', authData.user.id); 

    if (error) throw error;

    revalidatePath('/dashboard');
    return { success: true, message: 'Status atualizado.' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 3. DELETE (Excluir Alerta e Limpar o Lixo)
export async function deleteAlert(formData: FormData) {
  try {
    const alertId = formData.get('alertId') as string;

    if (!alertId) return { success: false, message: 'ID não encontrado.' };

    const supabase = await getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData?.user) return { success: false, message: 'Não autorizado.' };

    await supabase.from('notifications').delete().eq('alert_id', alertId);
    await supabase.from('price_history').delete().eq('alert_id', alertId);

    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId)
      .eq('user_id', authData.user.id);

    if (error) throw error;

    revalidatePath('/dashboard');
    return { success: true, message: 'Alerta excluído permanentemente.' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}