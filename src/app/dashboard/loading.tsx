import { SkeletonCard } from "@/components/dashboard/SkeletonCard"; // Ajuste o caminho conforme criou

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-10 opacity-50">
        <div className="h-10 w-40 bg-slate-200 rounded-lg"></div>
        <div className="h-10 w-32 bg-slate-200 rounded-lg"></div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado do Formulário (Skeleton estático) */}
        <section className="lg:col-span-4 bg-white p-8 rounded-[2rem] shadow-xl border border-white h-fit opacity-50">
          <div className="h-6 w-32 bg-slate-200 rounded mb-6"></div>
          <div className="space-y-5">
            <div className="h-12 bg-slate-50 rounded-xl"></div>
            <div className="h-12 bg-slate-50 rounded-xl"></div>
            <div className="h-20 bg-slate-50 rounded-xl"></div>
          </div>
        </section>

        {/* Lado dos Cards (Onde o brilho acontece) */}
        <section className="lg:col-span-8 space-y-6">
          <div className="h-6 w-40 bg-slate-200 rounded mb-4 ml-2"></div>
          <SkeletonCard />
          <SkeletonCard />
        </section>
      </main>
    </div>
  );
}