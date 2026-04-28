'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// 🛠️ HELPER: Instância para Auth (Validação do Usuário Logado)
async function getSupabaseAuth() {
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

// 🛠️ HELPER: Instância Admin para Bypass de RLS (Row Level Security) nas mutações
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function createMilesAlert(formData: FormData) {
  const supabaseAuth = await getSupabaseAuth()
  
  // 1. Validação de Sessão (Zero-Trust)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    console.error('Falha de segurança: Tentativa de criação sem usuário logado.')
    return
  }

  // 2. Extração e Sanitização de Dados (Agora operando em BRL / Float)
  const passengerName = formData.get('passengerName') as string
  const origin = (formData.get('origin') as string).toUpperCase()
  const destination = (formData.get('destination') as string).toUpperCase()
  const departureDate = formData.get('departureDate') as string
  
  // ParseFloat para aceitar centavos do input de dinheiro
  const thresholdPrice = parseFloat(formData.get('thresholdPrice') as string)

  let routeId: string;

  // 3. Upsert Lógico da Rota usando Admin (Bypass RLS)
  const { data: existingRoute } = await supabaseAdmin
    .from('routes')
    .select('id')
    .eq('origin', origin)
    .eq('destination', destination)
    .eq('departure_date', departureDate)
    .single()

  if (existingRoute) {
    routeId = existingRoute.id
  } else {
    const { data: newRoute, error: routeError } = await supabaseAdmin
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

  // 4. Inserção do Alerta Final usando Admin (Refletindo nova coluna de preço)
  const { error: alertError } = await supabaseAdmin
    .from('alerts')
    .insert([{
      user_id: user.id,
      route_id: routeId,
      passenger_name: passengerName,
      threshold_price: thresholdPrice,
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
  const alertId = formData.get('alertId') as string
  const currentState = formData.get('isActive') === 'true'

  const { error } = await supabaseAdmin
    .from('alerts')
    .update({ is_active: !currentState })
    .eq('id', alertId)

  if (!error) {
    revalidatePath('/dashboard')
  }
}

export async function deleteAlert(formData: FormData) {
  const alertId = formData.get('alertId') as string

  const { error } = await supabaseAdmin
    .from('alerts')
    .delete()
    .eq('id', alertId)

  if (!error) {
    revalidatePath('/dashboard')
  }
}