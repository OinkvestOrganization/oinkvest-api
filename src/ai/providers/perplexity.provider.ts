import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AiProviderInterface } from '../interfaces/ai-provider.interface';

@Injectable()
export class PerplexityProvider implements AiProviderInterface {
  private readonly logger = new Logger(PerplexityProvider.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.perplexity.ai/chat/completions';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const apiKey = this.configService.get<string>('PERPLEXITY_API_KEY');
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set in environment variables');
    }
    this.apiKey = apiKey;
  }

  async generateResponse(prompt: string): Promise<any> {
    const payload = {
      model: 'sonar', // Modelo leve e rápido
      messages: [
        {
          role: 'system',
          content:
            'You are a financial assistant. Return strictly a JSON object. Be concise.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 250,
      temperature: 0.2,
      // Perplexity não tem 'response_format: json_object' nativo igual OpenAI,
      // então confiamos no system prompt acima.
    };

    try {
      const response = await lastValueFrom(
        this.httpService.post(this.apiUrl, payload, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      // Tratamento para garantir que o retorno seja um objeto, caso a IA devolva texto
      const content = response.data.choices[0].message.content;

      try {
        // 1. Tenta limpar markdown básico e parsear direto
        const simpleClean = content
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        return JSON.parse(simpleClean);
      } catch {
        // 2. Se falhar, usa REGEX para encontrar o JSON "escondido" no texto

        // Tenta achar um Array [...]
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          return JSON.parse(arrayMatch[0]);
        }

        // Tenta achar um Objeto {...}
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          return JSON.parse(objectMatch[0]);
        }

        // Se chegou aqui, a IA não mandou JSON válido
        console.error(
          'Falha crítica ao parsear JSON da Perplexity. Conteúdo recebido:',
          content,
        );

        // Retorna um fallback amigável para não quebrar o front
        return [
          {
            id: 'error',
            title: 'Indisponível no momento',
            summary:
              'A IA não conseguiu formatar os dados de opinião corretamente. Tente novamente em instantes.',
            sentiment: 'neutral',
          },
        ];
      }
    } catch (error) {
      this.logger.error(
        'Error contacting Perplexity',
        error.response?.data || error.message,
      );
      return [];
    }
  }
}
