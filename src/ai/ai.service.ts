import { Inject, Injectable } from '@nestjs/common';
import type { AiProviderInterface } from './interfaces/ai-provider.interface';

@Injectable()
export class AiService {
  constructor(
    @Inject('AI_PROVIDER') private readonly aiProvider: AiProviderInterface,
  ) {}

  async ask(question: string) {
    return this.aiProvider.generateResponse(question);
  }

  async getMarketTrends() {
    const prompt = `
      Atue como um analista de criptoativos.
      Liste as 3 criptomoedas que estão em "Tendência de Alta" ou "Hype" neste exato momento.
      Consulte fontes como CoinGecko 'Trending' ou CoinMarketCap.
      
      Retorne APENAS um Array JSON (sem markdown).
      Estrutura:
      [
        {
          "id": "simbolo-moeda",
          "title": "Nome da Moeda (max 50 chars)(Ex: Solana)",
          "summary": "Motivo breve da alta (max 10 palavras) (Ex: Aumento de volume devido a novo protocolo NFT).",
          "sentiment": "positive"
        }
      ]
    `;
    return this.aiProvider.generateResponse(prompt);
  }

  async getExpertOpinions() {
    const prompt = `
      Acesse o sentimento geral do mercado cripto (Bitcoin/Ethereum) em sites como TradingView e Investing.com AGORA.
      Resuma o que os analistas técnicos estão dizendo (Compra Forte, Venda ou Neutro).
      
      Retorne APENAS um Array JSON com 3 pontos chave.
      Estrutura:
      [
        {
          "id": "1",
          "title": "Sentimento Geral (max 50 chars)(Ex: Compra Forte)",
          "summary": "Resumo da análise técnica (max 10 palavras)(Ex: Médias móveis indicam alta, mas RSI aponta sobrecompra).",
          "sentiment": "positive" | "negative" | "neutral"
        }
      ]
    `;
    return this.aiProvider.generateResponse(prompt);
  }

  async getCryptoNews() {
    // Prompt super otimizado para economia de tokens e formato estrito
    const prompt = `
      Liste as 3 notícias mais urgentes e impactantes sobre o mercado de criptomoedas (Bitcoin, Ethereum, Altcoins) das últimas 24 horas.
      
      Regras de Resposta OBRIGATÓRIAS:
      1. Retorne APENAS um Array JSON válido.
      2. NÃO use formatação Markdown (sem \`\`\`json).
      3. NÃO escreva texto introdutório.
      4. O idioma deve ser Português (PT-BR).
      
      Estrutura do JSON:
      [
        {
          "id": "string única",
          "title": "Título curto e chamativo (max 50 chars)",
          "summary": "Resumo informativo e direto (max 10 palavras)",
          "sentiment": "positive" | "negative" | "neutral"
        }
      ]
    `;

    return this.aiProvider.generateResponse(prompt);
  }
}
