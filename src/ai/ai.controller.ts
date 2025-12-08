import { Body, Controller, Get, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  async askAi(@Body('question') question: string) {
    return this.aiService.ask(question);
  }

  @Get('news')
  async getNews() {
    return this.aiService.getCryptoNews();
  }

  @Get('trends')
  async getTrends() {
    return this.aiService.getMarketTrends();
  }

  @Get('opinions')
  async getOpinions() {
    return this.aiService.getExpertOpinions();
  }
}
