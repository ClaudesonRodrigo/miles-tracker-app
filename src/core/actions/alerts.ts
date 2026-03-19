'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// 🛠️ HELPER: Instância centralizada do Supabase para Server Actions
async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // Ignorado em Server Actions, o Middleware gerencia a renovação de sessão
          }
        },
      },
    }
  )
}

export async function createMilesAlert(formData: FormData) {
  const supabase = await getSupabase()
  
  // 1. Validação de Sessão
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('Falha de segurança: Tentativa de criação sem usuário logado.')
    return
  }

  // 2. Extração e Sanitização de Dados (Evita lixo no banco)
  const passengerName = formData.get('passengerName') as string
  const origin = (formData.get('origin') as string).toUpperCase()
  const destination = (formData.get('destination') as string).toUpperCase()
  const departureDate = formData.get('departureDate') as string
  const thresholdMiles = parseInt(formData.get('thresholdMiles') as string, 10)

  let routeId: string;

  // 3. Upsert Lógico da Rota (Previne erro de constraint UNIQUE)
  const { data: existingRoute } = await supabase
    .from('routes')
    .select('id')
    .eq('origin', origin)
    .eq('destination', destination)
    .eq('departure_date', departureDate)
    .single()

  if (existingRoute) {
    routeId = existingRoute.id
  } else {
    const { data: newRoute, error: routeError } = await supabase
      .from('routes')
      .insert([{ origin, destination, departure_date: departureDate }])
      .select('id')
      .single()
      
    if (routeError) {
      console.error('🔥 [DB Error] Falha ao criar a rota:', routeError)
      return
    }
    routeId = newRoute.id
  }

  // 4. Inserção do Alerta Final
  const { error: alertError } = await supabase
    .from('alerts')
    .insert([{
      user_id: user.id,
      route_id: routeId,
      passenger_name: passengerName,
      threshold_miles: thresholdMiles,
      is_active: true
    }])

  if (alertError) {
    console.error('🔥 [DB Error] Falha ao atrelar o alerta:', alertError)
    return
  }

  // 5. Purga de Cache: Obriga o Next.js a atualizar a tela do Dashboard instantaneamente
  revalidatePath('/dashboard')
}

export async function toggleAlertStatus(formData: FormData) {
  const supabase = await getSupabase()
  const alertId = formData.get('alertId') as string
  const currentState = formData.get('isActive') === 'true'

  const { error } = await supabase
    .from('alerts')
    .update({ is_active: !currentState })
    .eq('id', alertId)

  if (!error) {
    revalidatePath('/dashboard')
  }
}

export async function deleteAlert(formData: FormData) {
  const supabase = await getSupabase()
  const alertId = formData.get('alertId') as string

  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('id', alertId)

  if (!error) {
    revalidatePath('/dashboard')
  }
}