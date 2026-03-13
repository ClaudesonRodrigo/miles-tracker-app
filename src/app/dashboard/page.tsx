import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createMilesAlert, toggleAlertStatus, deleteAlert } from '@/core/actions/alerts';

export default async function DashboardPage() {
  const cookieStore = await cookies();

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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // A Query agora pede as três colunas granulares
  const { data: alerts } = await supabase
    .from('alerts')
    .select(`
      id,
      passenger_name,
      miles_gol,
      miles_latam,
      miles_azul,
      threshold_miles,
      is_active,
      created_at,
      routes (
        origin,
        destination,
        departure_date
      ),
      notifications (
        id,
        airline,
        found_miles,
        is_read,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex justify-between items-center border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Painel Rastreio Triplo</h1>
            <p className="text-gray-400 mt-1">Monitore os preços simultâneos na Gol, Latam e Azul.</p>
          </div>
          <div className="text-sm text-gray-500">
            Logado como: <span className="text-gray-300">{user.email}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-1 bg-gray-800 p-6 rounded-xl border border-gray-700 h-fit shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">Criar Novo Alerta</h2>
            
            {/* @ts-expect-error */}
            <form action={createMilesAlert} className="space-y-4">
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome do Passageiro</label>
                <input name="passengerName" type="text" required placeholder="Ex: João Silva" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Origem (Sigla)</label>
                  <input name="origin" type="text" required maxLength={3} placeholder="AJU" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white uppercase text-center focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Destino (Sigla)</label>
                  <input name="destination" type="text" required maxLength={3} placeholder="GIG" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white uppercase text-center focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Data do Voo</label>
                <input name="departureDate" type="date" required className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Novo Bloco: Input Granular das Companhias */}
              <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                <label className="block text-sm font-semibold text-gray-300 mb-3 text-center">Base Atual de Milhas (Se aplicável)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-orange-400 mb-1 text-center">GOL</label>
                    <input name="milesGol" type="number" placeholder="Ex: 35k" className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm text-white text-center" />
                  </div>
                  <div>
                    <label className="block text-xs text-red-500 mb-1 text-center">LATAM</label>
                    <input name="milesLatam" type="number" placeholder="Ex: 30k" className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm text-white text-center" />
                  </div>
                  <div>
                    <label className="block text-xs text-blue-400 mb-1 text-center">AZUL</label>
                    <input name="milesAzul" type="number" placeholder="Ex: 40k" className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-sm text-white text-center" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Alvo Desejado (Avisar abaixo de)</label>
                <input name="thresholdMiles" type="number" required placeholder="Ex: 15000" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-green-500 border-green-900/50" />
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition-colors mt-4">
                Ativar Robô Rastreador
              </button>
            </form>
          </div>

          <div className="md:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-200">Os Seus Rastreadores Ativos</h2>
            
            {!alerts || alerts.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 border-dashed rounded-xl p-8 text-center text-gray-400">
                Ainda não tem nenhum alerta configurado.
              </div>
            ) : (
              alerts.map((alert) => {
                // @ts-ignore
                const unreadNotifs = alert.notifications?.filter(n => !n.is_read) || [];
                const hasNotification = unreadNotifs.length > 0;
                const latestNotif = hasNotification ? unreadNotifs[0] : null;

                return (
                  <div key={alert.id} className={`bg-gray-800 p-5 rounded-xl border flex flex-col shadow-sm transition-colors gap-2 ${hasNotification ? 'border-red-500/50' : 'border-gray-700 hover:border-blue-500'}`}>
                    
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-blue-900/40 text-blue-300 text-xs px-2 py-1 rounded font-medium border border-blue-800/50">
                            👤 {alert.passenger_name}
                          </span>
                          {hasNotification && (
                            <span className="flex h-3 w-3 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mb-1">
                          {/* @ts-ignore */}
                          <span className="text-2xl font-black text-white">{alert.routes.origin}</span>
                          <span className="text-gray-500">✈️</span>
                          {/* @ts-ignore */}
                          <span className="text-2xl font-black text-white">{alert.routes.destination}</span>
                        </div>
                        <div className="text-sm text-gray-400">
                          {/* @ts-ignore */}
                          Data: <span className="text-gray-200">{new Date(alert.routes.departure_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      
                      <div className="md:text-right flex flex-col items-end">
                        <div className="text-sm text-gray-400 mb-1">Alvo estabelecido</div>
                        <div className="text-2xl font-black text-green-400">
                          &lt; {alert.threshold_miles.toLocaleString('pt-BR')}
                        </div>
                        <div className="mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${alert.is_active ? 'bg-blue-900/50 text-blue-400 border border-blue-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
                            {alert.is_active ? 'Monitorando 24h' : 'Pausado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Novo Bloco: Painel Comparativo Triplo */}
                    <div className="grid grid-cols-3 gap-4 mt-4 bg-gray-900/40 rounded-lg p-3 border border-gray-700/50 divide-x divide-gray-700/50">
                      <div className="text-center">
                        <span className="block text-xs font-bold text-orange-400 mb-1">GOL</span>
                        <span className="text-gray-400 line-through text-sm">{alert.miles_gol > 0 ? alert.miles_gol.toLocaleString('pt-BR') : 'N/A'}</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-xs font-bold text-red-500 mb-1">LATAM</span>
                        <span className="text-gray-400 line-through text-sm">{alert.miles_latam > 0 ? alert.miles_latam.toLocaleString('pt-BR') : 'N/A'}</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-xs font-bold text-blue-400 mb-1">AZUL</span>
                        <span className="text-gray-400 line-through text-sm">{alert.miles_azul > 0 ? alert.miles_azul.toLocaleString('pt-BR') : 'N/A'}</span>
                      </div>
                    </div>

                    {latestNotif && (
                      <div className="mt-3 bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <span>🔥</span>
                          <span>
                            A <strong>{latestNotif.airline}</strong> baixou o preço para <strong>{latestNotif.found_miles.toLocaleString('pt-BR')} milhas</strong>!
                          </span>
                        </div>
                        <button className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors">
                          Marcar Lido
                        </button>
                      </div>
                    )}

                    {/* AÇÕES DO CRUD */}
                    <div className="mt-3 pt-3 border-t border-gray-700/50 flex justify-end gap-6">
                      {/* @ts-expect-error */}
                      <form action={toggleAlertStatus}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <input type="hidden" name="isActive" value={String(alert.is_active)} />
                        <button type="submit" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                          {alert.is_active ? '⏸️ Pausar' : '▶️ Retomar'}
                        </button>
                      </form>

                      {/* @ts-expect-error */}
                      <form action={deleteAlert}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <button type="submit" className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors">
                          🗑️ Excluir
                        </button>
                      </form>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </main>
  );
}