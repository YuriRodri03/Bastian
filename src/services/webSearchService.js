// src/services/webSearchService.js
import { supabase } from '../lib/supabase';

// A chamada ao Gemini acontece na Edge Function "web-search": a chave de API não existe mais no navegador.
// Devolve sempre um objeto com "status": 'sucesso' | 'sem_fontes' | 'sem_resultados' | 'limite_de_uso' | 'erro'.

const TIMEOUT_MS = 25000; // um pouco acima do limite de 20 s da função

const comTimeout = (promessa, ms) =>
  Promise.race([
    promessa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo esgotado na busca.')), ms))
  ]);

export async function buscarNaWebComGemini(consulta) {
  const texto = String(consulta ?? '').trim();
  if (!texto) return { status: 'erro', mensagem: 'Consulta vazia.' };

  try {
    const { data, error } = await comTimeout(
      supabase.functions.invoke('web-search', { body: { consulta: texto } }),
      TIMEOUT_MS
    );

    if (error || !data?.status) throw error || new Error('Resposta vazia da função de busca.');
    return data;
  } catch (erro) {
    console.error('[Bastian WebSearch] Erro ao pesquisar na internet:', erro);
    return { status: 'erro', mensagem: 'Não foi possível acessar a busca na web neste instante.' };
  }
}