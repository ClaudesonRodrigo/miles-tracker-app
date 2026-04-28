export async function sendTelegramMessage(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('🔥 [Telegram] Faltam credenciais (Token ou Chat ID no .env.local).');
    return false;
  }

  // Endpoint oficial da API do Telegram
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Usamos o parse_mode HTML para podermos enviar texto em negrito, itálico, etc.
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
      // Evita cache para garantir que todas as mensagens cheguem em tempo real
      cache: 'no-store'
    });

    if (response.ok) {
      console.log(`✅ [Telegram] Notificação enviada com sucesso para o chat ${chatId}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ [Telegram] Falha ao enviar. Erro: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`🔥 [Telegram] Erro de rede (Caiu a conexão):`, error);
    return false;
  }
}