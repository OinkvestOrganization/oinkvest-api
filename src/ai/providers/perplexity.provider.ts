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

      const cleanContent = content
        .replace(/^```json\s*/, '') // Remove o inicio ```json
        .replace(/^```\s*/, '') // Remove o inicio ```
        .replace(/\s*```$/, '') // Remove o final ```
        .trim(); // Remove espaços em branco nas pontas

      try {
        return JSON.parse(cleanContent);
      } catch {
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        console.error('Falha ao parsear JSON da IA:', cleanContent);
        return {
          message:
            'Oink! Recebi a resposta mas não consegui ler. Tente de novo! 🐽',
        };
      }
    } catch (error) {
      this.logger.error(
        'Error contacting Perplexity',
        error.response?.data || error.message,
      );
      throw new Error('Failed to generate AI response');
    }
  }
}
