'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => { cookieStore.set(name, value, options); }); } catch (error) {}
        },
      },
    }
  );
}

// 1. CREATE (Arquitetura Desacoplada: Criação Instantânea)
export async function createMilesAlert(formData: FormData) {
  console.log("🚀 [Server Action] Iniciando criação do Alerta Assíncrono...");
  
  try {
    const passengerName = formData.get('passengerName') as string;
    const origin = formData.get('origin') as string;
    const destination = formData.get('destination') as string;
    const departureDate = formData.get('departureDate') as string;
    const thresholdMiles = Number(formData.get('thresholdMiles'));

    if (!passengerName || !origin || !destination || !departureDate || !thresholdMiles) {
      return { success: false, message: 'Preencha todos os campos obrigatórios.' };
    }

    const supabase = await getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      return { success: false, message: 'Lead não autenticado.' };
    }

    const userId = authData.user.id;
    let routeId;

    // FIND OR CREATE: Garante que a rota existe sem duplicar
    const { data: existingRoutes } = await supabase
      .from('routes')
      .select('id')
      .eq('origin', origin.toUpperCase())
      .eq('destination', destination.toUpperCase())
      .eq('departure_date', departureDate);

    if (existingRoutes && existingRoutes.length > 0) {
      routeId = existingRoutes[0].id;
    } else {
      const { data: newRoute, error: insertError } = await supabase
        .from('routes')
        .insert([{ origin: origin.toUpperCase(), destination: destination.toUpperCase(), departure_date: departureDate }])
        .select('id')
        .single();

      if (insertError) return { success: false, message: `Erro na rota: ${insertError.message}` };
      routeId = newRoute.id;
    }

    // DECOUPLING: Gravamos o alerta na hora para libertar o ecrã do cliente
    const { error: alertError } = await supabase
      .from('alerts')
      .insert([{
        user_id: userId,
        route_id: routeId,
        passenger_name: passengerName,
        miles_gol: 0,
        miles_latam: 0,
        miles_azul: 0,
        threshold_miles: thresholdMiles,
        is_active: true
      }]);

    if (alertError) {
      console.error("❌ [Erro no Supabase - Alerta]", alertError);
      return { success: false, message: `Erro no alerta: ${alertError.message}` };
    }

    console.log("🎉 [Sucesso] Alerta criado com sucesso! Liberando a interface...");
    revalidatePath('/dashboard');

    return { success: true, message: 'Rastreador ativado! O robô vai varrer os preços em background.' };

  } catch (error: any) {
    console.error("🔥 [Erro Crítico na Ação]", error);
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