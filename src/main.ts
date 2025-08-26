import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Oinkvest API')
    .setDescription('Guia de rotas da API Oinkvest')
    .setContact('Oinkvest', 'https://oinkvest.com.br', 'oinkvest@gmail.com')
    .setOpenAPIVersion('3.1.0')
    .setVersion('0.1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory());

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
