// src/services/webSearchService.js

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const REST_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

export async function buscarNaWebComGemini(consulta) {
  if (!consulta) return { erro: "Consulta vazia." };

  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  try {
    const response = await fetch(REST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Data de hoje: ${dataHoje} (Local: Fortaleza, CE, Brasil).
Pesquise no Google em tempo real e responda de forma direta, factual e com dados/números atualizados à seguinte solicitação: "${consulta}".
Forneça um resumo objetivo de 3 a 5 frases pronto para ser lido em voz alta.`
              }
            ]
          }
        ],
        // Ativa o Google Search Grounding oficial da API do Gemini
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Status HTTP: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const textoResposta =
      candidate?.content?.parts?.map((p) => p.text).join(' ') ||
      'Não encontrei resultados recentes para essa busca.';

    // Extrai os títulos/links das fontes consultadas no Google (se disponíveis)
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const fontes = chunks
      .map((c) => c.web?.title)
      .filter(Boolean)
      .slice(0, 4);

    return {
      status: 'sucesso',
      data_consulta: dataHoje,
      resultado_atualizado: textoResposta.trim(),
      fontes_consultadas: fontes
    };
  } catch (error) {
    console.error('[Bastian WebSearch] Erro ao pesquisar na internet:', error);
    return {
      status: 'erro',
      mensagem: 'Não foi possível acessar a busca na web neste instante.'
    };
  }
}