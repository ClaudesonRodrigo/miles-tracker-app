import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createMilesAlert, toggleAlertStatus, deleteAlert } from '@/core/actions/alerts';
import AlertToast from '@/components/dashboard/AlertToast';
// 🚀 OVERRIDE DE CACHE: Obriga o Next.js a ler o banco de dados fresco a cada F5
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// 🛠️ TIPAGEM FORTE (Enterprise): Eliminando o uso de 'any'
interface RouteData {
  origin: string;
  destination: string;
  departure_date: string;
}

interface NotificationData {
  id: string | number;
  airline: string;
  found_price: number;
  is_read: boolean;
  created_at: string;
}

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined || value === 0) return 'R$ ---';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getAirlineHome = (airline: string) => {
  const links: Record<string, string> = {
    'GOL': 'https://www.voegol.com.br/',
    'LATAM': 'https://www.latamairlines.com/',
    'AZUL': 'https://www.voeazul.com.br/'
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
      price_gol,
      price_latam,
      price_azul,
      threshold_price,
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
        found_price,
        is_read,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

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
      <AlertToast />
      
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
        
        {/* COLUNA ESQUERDA: FORMULÁRIO DE NOVO ALERTA */}
        <section className="lg:col-span-4 bg-white p-8 rounded-4xl shadow-xl shadow-slate-200/50 border border-white h-fit">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
            <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
            Novo Alerta de Preço
          </h2>
          {/* As Server Actions em Next.js 14/15 são suportadas nativamente sem precisar de @ts-ignore */}
          <form action={createMilesAlert} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Passageiro / Cliente</label>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alvo (Avisar se cair abaixo de)</label>
              <input name="thresholdPrice" type="number" step="0.01" placeholder="Ex: 850.50" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl hover:bg-blue-600 transition-all shadow-lg active:scale-[0.98]">
              Ativar Rastreador
            </button>
          </form>
        </section>

        {/* COLUNA DIREITA: RASTREADORES ATIVOS (CARDS) */}
        <section className="lg:col-span-8 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 px-2 tracking-tight">Rastreadores Ativos</h2>

          {(!alerts || alerts.length === 0) ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-4xl p-20 text-center text-slate-400">
              Nenhum robô configurado no momento.
            </div>
          ) : (
            alerts.map((alert) => {
              
              // 🛠️ ESTRATÉGIA SENIOR: Convertendo os tipos de forma segura (sem 'any')
              const routeData = (Array.isArray(alert.routes) ? alert.routes[0] : alert.routes) as unknown as RouteData;
              const origin = routeData?.origin || '---';
              const destination = routeData?.destination || '---';
              const departureDate = routeData?.departure_date;

              // Tipagem segura para a lista de notificações
              const rawNotifications = (alert.notifications as unknown as NotificationData[]) || [];
              const unreadNotifs = rawNotifications.filter(n => !n.is_read);
              const hasNotification = unreadNotifs.length > 0;

              // Lógica BRL mantida intocada
              const isGolOpp = alert.price_gol !== null && alert.price_gol <= alert.threshold_price;
              const isLatamOpp = alert.price_latam !== null && alert.price_latam <= alert.threshold_price;
              const isAzulOpp = alert.price_azul !== null && alert.price_azul <= alert.threshold_price;

              return (
                <div key={alert.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-300 overflow-hidden mb-6 group">
                  
                  {/* CABEÇALHO DO CARD */}
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded uppercase tracking-wider">
                          👤 {alert.passenger_name}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          {departureDate ? new Date(departureDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data não informada'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-black text-slate-900 tracking-tight">{origin}</span>
                        <div className="w-12 h-px bg-slate-300 relative flex justify-center items-center">
                          <span className="absolute text-slate-400 text-lg">✈</span>
                        </div>
                        <span className="text-3xl font-black text-slate-900 tracking-tight">{destination}</span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border mb-2 ${alert.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                        {alert.is_active && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {alert.is_active ? 'Monitorando' : 'Pausado'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Alvo / Teto</span>
                         <span className="text-lg font-black text-slate-800">&lt; {formatCurrency(alert.threshold_price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* CORPO DO CARD */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                      <a 
                        href={getAirlineHome('GOL')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`relative p-5 rounded-2xl border transition-all cursor-pointer ${isGolOpp ? 'bg-orange-50 border-orange-400 shadow-sm shadow-orange-100' : 'bg-white border-slate-200 hover:border-orange-300 hover:bg-slate-50'}`}
                      >
                        {isGolOpp && <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shadow-md animate-bounce">Oportunidade</div>}
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-black text-orange-600 uppercase tracking-wider">GOL</p>
                          <span className="text-[10px] font-semibold text-slate-400">Comprar ➔</span>
                        </div>
                        <p className={`text-2xl font-black ${isGolOpp ? 'text-orange-700' : 'text-slate-800'}`}>
                          {formatCurrency(alert.price_gol)}
                        </p>
                      </a>

                      <a 
                        href={getAirlineHome('LATAM')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`relative p-5 rounded-2xl border transition-all cursor-pointer ${isLatamOpp ? 'bg-red-50 border-red-400 shadow-sm shadow-red-100' : 'bg-white border-slate-200 hover:border-red-300 hover:bg-slate-50'}`}
                      >
                        {isLatamOpp && <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shadow-md animate-bounce">Oportunidade</div>}
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-black text-red-600 uppercase tracking-wider">LATAM</p>
                          <span className="text-[10px] font-semibold text-slate-400">Comprar ➔</span>
                        </div>
                        <p className={`text-2xl font-black ${isLatamOpp ? 'text-red-700' : 'text-slate-800'}`}>
                          {formatCurrency(alert.price_latam)}
                        </p>
                      </a>

                      <a 
                        href={getAirlineHome('AZUL')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`relative p-5 rounded-2xl border transition-all cursor-pointer ${isAzulOpp ? 'bg-blue-50 border-blue-400 shadow-sm shadow-blue-100' : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                      >
                        {isAzulOpp && <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shadow-md animate-bounce">Oportunidade</div>}
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-black text-blue-600 uppercase tracking-wider">AZUL</p>
                          <span className="text-[10px] font-semibold text-slate-400">Comprar ➔</span>
                        </div>
                        <p className={`text-2xl font-black ${isAzulOpp ? 'text-blue-700' : 'text-slate-800'}`}>
                          {formatCurrency(alert.price_azul)}
                        </p>
                      </a>
                    </div>

                    {/* MENSAGEM DE NOTIFICAÇÃO */}
                    {hasNotification && (
                       <div className="mt-4 p-4 bg-emerald-600 rounded-xl text-white flex items-center justify-between shadow-lg shadow-emerald-100 animate-pulse">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🔥</span>
                          <p className="text-sm font-bold italic underline underline-offset-4">
                            Oportunidade de R$ {unreadNotifs[0].found_price} encontrada na {unreadNotifs[0].airline}!
                          </p>
                        </div>
                      </div>
                    )}

                    {/* RODAPÉ */}
                    <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                      <form action={toggleAlertStatus} className="flex-1">
                        <input type="hidden" name="alertId" value={alert.id} />
                        <input type="hidden" name="isActive" value={String(alert.is_active)} />
                        <button className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${alert.is_active ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-slate-800 border-slate-800 text-white hover:bg-slate-700'}`}>
                          {alert.is_active ? 'Pausar Monitoramento' : 'Retomar Monitoramento'}
                        </button>
                      </form>
                      
                      <form action={deleteAlert}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <button className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all">
                          Deletar
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