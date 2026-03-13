import React from 'react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-6">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl font-bold mb-6">
          Monitore Milhas e Voe Mais Barato
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Receba alertas em tempo real no seu celular quando as passagens da Latam, Gol e Azul atingirem o seu preço ideal.
        </p>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-lg text-lg transition-colors">
          Criar Meu Primeiro Alerta
        </button>
      </div>
    </main>
  );
}