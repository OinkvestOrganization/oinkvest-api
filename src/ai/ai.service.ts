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
          "title": "Título curto e chamativo (max 60 chars)",
          "summary": "Resumo informativo e direto (max 20 palavras)",
          "sentiment": "positive" | "negative" | "neutral"
        }
      ]
    `;

    return this.aiProvider.generateResponse(prompt);
  }
}
