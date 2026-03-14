import React from 'react';

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm animate-pulse">
      {/* Header do Card */}
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-3">
          <div className="h-3 w-20 bg-slate-100 rounded uppercase"></div>
          <div className="h-8 w-48 bg-slate-200 rounded-xl"></div>
          <div className="h-3 w-32 bg-slate-100 rounded mt-2"></div>
        </div>
        <div className="text-right space-y-2">
          <div className="h-4 w-12 bg-slate-100 rounded ml-auto"></div>
          <div className="h-8 w-24 bg-blue-50 rounded-lg ml-auto"></div>
        </div>
      </div>
      
      {/* Grid de Preços (GOL, LATAM, AZUL) */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="h-20 bg-slate-50 rounded-2xl border border-slate-100"></div>
        <div className="h-20 bg-slate-50 rounded-2xl border border-slate-100"></div>
        <div className="h-20 bg-slate-50 rounded-2xl border border-slate-100"></div>
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-4 pt-6 border-t border-slate-50">
        <div className="h-12 flex-1 bg-slate-100 rounded-xl"></div>
        <div className="h-12 w-24 bg-slate-50 rounded-xl"></div>
      </div>
    </div>
  );
}