import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AiProviderInterface } from '../interfaces/ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProviderInterface {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not defined in environment variables');
    }
    this.apiKey = apiKey;
  }

  async generateResponse(prompt: string): Promise<any> {
    const payload = {
      model: 'gpt-4o-mini', // Modelo mais barato e eficiente atualmente
      messages: [
        {
          role: 'system',
          content:
            'You are a crypto financial assistant. Answer in JSON format.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 250, // Limite
      temperature: 0.2, // Baixa criatividade para evitar alucinações
      response_format: { type: 'json_object' }, // Força retorno JSON
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

      const content = response.data.choices[0].message.content;

      const cleanContent = content
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      try {
        return JSON.parse(cleanContent);
      } catch {
        // Fallback: Tenta encontrar o JSON no meio do texto
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }

        console.error('Falha ao parsear JSON da OpenAI:', cleanContent);
        return {
          message: 'Oink! Tive um problema técnico. Tente novamente! 🐽',
        };
      }
    } catch (error) {
      this.logger.error(
        'Error contacting OpenAI',
        error.response?.data || error.message,
      );
      throw new Error('Failed to generate AI response');
    }
  }
}
