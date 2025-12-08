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

      try {
        // 1. Limpeza básica de Markdown (```json ... ```)
        const simpleClean = content
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        return JSON.parse(simpleClean);
      } catch {
        // 2. Fallback com REGEX: Procura JSON "escondido" no texto

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

        // Se chegou aqui, o conteúdo é irrecuperável
        this.logger.error('Falha crítica ao parsear JSON da OpenAI:', content);

        // Retorna Array vazio ou objeto de erro para não quebrar o map() do front
        return [];
      }
    } catch (error) {
      if (error.response) {
        this.logger.error(
          'Erro API OpenAI:',
          JSON.stringify(error.response.data),
        );
      } else {
        this.logger.error('Erro Interno OpenAI:', error.message);
      }
      return [];
    }
  }
}
