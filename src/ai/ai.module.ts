import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAiProvider } from './providers/openai.provider';
import { PerplexityProvider } from './providers/perplexity.provider';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [AiController],
  providers: [
    AiService,
    OpenAiProvider, // Registra a classe para injeção
    PerplexityProvider, // Registra a classe para injeção
    {
      provide: 'AI_PROVIDER', // O token que o Service usa para injetar
      useFactory: (
        configService: ConfigService,
        httpService: HttpService, // Necessário passar as dependências
      ) => {
        const providerName = configService.get<string>('AI_PROVIDER');

        if (providerName === 'openai') {
          return new OpenAiProvider(configService, httpService);
        }

        // Default para Perplexity
        return new PerplexityProvider(configService, httpService);
      },
      inject: [ConfigService, HttpService],
    },
  ],
})
export class AiModule {}
