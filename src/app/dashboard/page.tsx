import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createMilesAlert } from '@/core/actions/alerts';

export default async function DashboardPage() {
  // No Next.js 15, cookies() é uma função assíncrona
  const cookieStore = await cookies();

  // Instancia o Supabase para rodar no Servidor (SSR - Server-Side Rendering)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  // Pega o usuário autenticado
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fazemos um JOIN poderoso no PostgreSQL: Busca os alertas E as rotas conectadas a eles
  const { data: alerts } = await supabase
    .from('alerts')
    .select(`
      id,
      threshold_miles,
      is_active,
      created_at,
      routes (
        origin,
        destination,
        departure_date
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header do Dashboard */}
        <header className="flex justify-between items-center border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Painel de Alertas</h1>
            <p className="text-gray-400 mt-1">Monitore suas rotas na Latam, Gol e Azul.</p>
          </div>
          <div className="text-sm text-gray-500">
            Logado como: <span className="text-gray-300">{user.email}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Coluna Esquerda: Formulário de Criação (Ação Principal) */}
          <div className="md:col-span-1 bg-gray-800 p-6 rounded-xl border border-gray-700 h-fit shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">Criar Novo Alerta</h2>
            
            {/* O formulário chama nativamente a Server Action sem precisar de APIs complexas */}
            {/* @ts-expect-error - Tipagem do React 18 conflitando com Server Actions do Next 15 */}
            <form action={createMilesAlert} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Origem (Sigla)</label>
                  <input 
                    name="origin" 
                    type="text" 
                    required 
                    maxLength={3}
                    placeholder="AJU" 
                    defaultValue="AJU"
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white uppercase text-center focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Destino (Sigla)</label>
                  <input 
                    name="destination" 
                    type="text" 
                    required 
                    maxLength={3}
                    placeholder="GIG" 
                    defaultValue="GIG"
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white uppercase text-center focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Data do Voo</label>
                <input 
                  name="departureDate" 
                  type="date" 
                  required 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Me avise se baixar de (Milhas)</label>
                <input 
                  name="thresholdMiles" 
                  type="number" 
                  required 
                  placeholder="Ex: 15000"
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition-colors mt-4"
              >
                Ativar Robô Rastreador
              </button>
            </form>
          </div>

          {/* Coluna Direita: Lista de Alertas Ativos */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-200">Seus Rastreadores Ativos</h2>
            
            {!alerts || alerts.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 border-dashed rounded-xl p-8 text-center text-gray-400">
                Você ainda não tem nenhum alerta configurado.
                <br />Crie o seu primeiro alerta ao lado para começarmos a buscar.
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex justify-between items-center shadow-sm hover:border-blue-500 transition-colors">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl font-black text-white">
                        {/* @ts-ignore - Supabase tipagem de JOIN */}
                        {alert.routes.origin}
                      </span>
                      <span className="text-gray-500">✈️</span>
                      <span className="text-2xl font-black text-white">
                        {/* @ts-ignore */}
                        {alert.routes.destination}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      Data: {/* @ts-ignore */}
                      <span className="text-gray-200">{new Date(alert.routes.departure_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-gray-400 mb-1">Alvo estabelecido</div>
                    <div className="text-xl font-bold text-green-400">
                      &lt; {alert.threshold_miles.toLocaleString('pt-BR')} milhas
                    </div>
                    <div className="mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${alert.is_active ? 'bg-blue-900/50 text-blue-400 border border-blue-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
                        {alert.is_active ? 'Monitorando 24h' : 'Pausado'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </main>
  );
}