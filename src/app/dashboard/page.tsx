import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createMilesAlert, toggleAlertStatus, deleteAlert } from '@/core/actions/alerts';

// 🛠️ HELPER: Formatação de Milhas (Estilo Profissional)
const formatMiles = (value: number | null) => {
  if (value === null || value === undefined || value === 0) return '---';
  return new Intl.NumberFormat('pt-BR').format(value);
};

// ✈️ HELPER: Direcionamento para Home dos Programas de Fidelidade
const getAirlineHome = (airline: string) => {
  const links: Record<string, string> = {
    'GOL': 'https://www.smiles.com.br/',
    'LATAM': 'https://latampass.latam.com/',
    'AZUL': 'https://www.voeazul.com.br/br/pt/fidelidade'
  };
  return links[airline.toUpperCase()] || '#';
};

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

  // 🚪 Action de Logout (Refatorada para estabilidade)
  async function handleSignOut() {
    'use server';
    const c = await cookies();
    const s = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 
      {
        cookies: { 
          getAll() { return c.getAll(); }, 
          setAll(cookiesToSet) { 
            cookiesToSet.forEach(({ name, value, options }) => c.set(name, value, options)); 
          } 
        }
      }
    );
    await s.auth.signOut();
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans text-slate-900">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">Atlas<span className="text-blue-600">Develop</span></h1>
          <p className="text-slate-500 text-sm font-medium">Operador: <span className="text-slate-800 font-bold">{user.email}</span></p>
        </div>
        <form action={handleSignOut}>
          <button className="bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            Sair do Sistema
          </button>
        </form>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: Formulário */}
        <section className="lg:col-span-4 bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white h-fit">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
            <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
            Novo Alerta
          </h2>
          {/* @ts-expect-error */}
          <form action={createMilesAlert} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Passageiro</label>
              <input name="passengerName" type="text" placeholder="Nome do Cliente" className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder:text-slate-300 transition-all" required />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origem</label>
                <input name="origin" type="text" placeholder="AJU" className="w-full p-4 bg-slate-50 border-none rounded-2xl uppercase font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" maxLength={3} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destino</label>
                <input name="destination" type="text" placeholder="GIG" className="w-full p-4 bg-slate-50 border-none rounded-2xl uppercase font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" maxLength={3} required />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data do Voo</label>
              <input name="departureDate" type="date" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alvo (Avisar abaixo de)</label>
              <input name="thresholdMiles" type="number" placeholder="Ex: 15000" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl hover:bg-blue-600 transition-all shadow-lg active:scale-[0.98]">
              Ativar Rastreador
            </button>
          </form>
        </section>

        {/* COLUNA DIREITA: Cards */}
        <section className="lg:col-span-8 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 px-2 tracking-tight">Rastreadores Ativos</h2>

          {(!alerts || alerts.length === 0) ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-20 text-center text-slate-400">
              Nenhum robô configurado no momento.
            </div>
          ) : (
            alerts.map((alert) => {
              // @ts-ignore
              const unreadNotifs = alert.notifications?.filter(n => !n.is_read) || [];
              const hasNotification = unreadNotifs.length > 0;

              return (
                <div key={alert.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 overflow-hidden">
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                           <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-wider italic">
                            👤 {alert.passenger_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* @ts-ignore */}
                          <span className="text-3xl font-black text-slate-900">{alert.routes.origin}</span>
                          <span className="text-slate-300 font-light text-2xl">➔</span>
                          {/* @ts-ignore */}
                          <span className="text-3xl font-black text-slate-900">{alert.routes.destination}</span>
                        </div>
                        <p className="text-slate-400 text-xs mt-2 font-medium italic">
                          {/* @ts-ignore */}
                          Voo: {new Date(alert.routes.departure_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className={`flex items-center gap-2 justify-end mb-3`}>
                          {alert.is_active && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                          )}
                          <span className={`text-[10px] font-black uppercase tracking-widest ${alert.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                            {alert.is_active ? 'Scanning' : 'Pausado'}
                          </span>
                        </div>
                        <p className="text-2xl font-black text-blue-600 tracking-tighter italic">&lt; {formatMiles(alert.threshold_miles)}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Alvo Desejado</p>
                      </div>
                    </div>

                    {/* Preços com Links para a Home das Companhias */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      
                      {/* Card GOL */}
                      <a 
                        href={getAirlineHome('GOL')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center hover:bg-white hover:shadow-md hover:border-orange-200 transition-all cursor-pointer"
                      >
                        <p className="text-[9px] font-black text-orange-600 uppercase mb-1 tracking-widest">GOL</p>
                        <p className="text-xl font-black text-slate-800">{formatMiles(alert.miles_gol)}</p>
                        <span className="text-[8px] font-bold text-slate-300 group-hover:text-orange-500 transition-colors uppercase tracking-tighter italic">SMILES ➔</span>
                      </a>

                      {/* Card LATAM */}
                      <a 
                        href={getAirlineHome('LATAM')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center hover:bg-white hover:shadow-md hover:border-red-200 transition-all cursor-pointer"
                      >
                        <p className="text-[9px] font-black text-red-600 uppercase mb-1 tracking-widest">LATAM</p>
                        <p className="text-xl font-black text-slate-800">{formatMiles(alert.miles_latam)}</p>
                        <span className="text-[8px] font-bold text-slate-300 group-hover:text-red-500 transition-colors uppercase tracking-tighter italic">PASS ➔</span>
                      </a>

                      {/* Card AZUL */}
                      <a 
                        href={getAirlineHome('AZUL')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center hover:bg-white hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
                      >
                        <p className="text-[9px] font-black text-blue-600 uppercase mb-1 tracking-widest">AZUL</p>
                        <p className="text-xl font-black text-slate-800">{formatMiles(alert.miles_azul)}</p>
                        <span className="text-[8px] font-bold text-slate-300 group-hover:text-blue-500 transition-colors uppercase tracking-tighter italic">AZUL ➔</span>
                      </a>
                    </div>

                    {/* Notificação */}
                    {hasNotification && (
                       <div className="mb-6 p-4 bg-blue-600 rounded-2xl text-white flex items-center justify-between shadow-lg shadow-blue-100 animate-pulse">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🔥</span>
                          <p className="text-sm font-bold italic underline underline-offset-4">
                            Oportunidade encontrada na {unreadNotifs[0].airline}!
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Botões de Ação */}
                    <div className="flex gap-4 pt-6 border-t border-slate-50">
                      {/* @ts-expect-error */}
                      <form action={toggleAlertStatus} className="flex-1">
                        <input type="hidden" name="alertId" value={alert.id} />
                        <input type="hidden" name="isActive" value={String(alert.is_active)} />
                        <button className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${alert.is_active ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>
                          {alert.is_active ? 'Pausar Robô' : 'Retomar Robô'}
                        </button>
                      </form>
                      {/* @ts-expect-error */}
                      <form action={deleteAlert}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <button className="px-6 py-3 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-xl transition-all">
                          Remover
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}