import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AsyncApiDocumentBuilder, AsyncApiModule } from 'nestjs-asyncapi';
import { ValidationPipe } from '@nestjs/common';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new BigIntInterceptor());
  const config = new DocumentBuilder()
    .setTitle('Oinkvest API')
    .setDescription('Guia de rotas da API Oinkvest')
    .setContact('Oinkvest', 'https://oinkvest.com.br', 'oinkvest@gmail.com')
    .addBearerAuth()
    .setOpenAPIVersion('3.1.0')
    .setVersion('0.1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory());

  const asyncApiOptions = new AsyncApiDocumentBuilder()
    .setTitle('Oinkvest WebSocket API')
    .setDescription('Guia de rotas da API Oinkvest')
    .setVersion('1.0')
    .setDefaultContentType('application/json')
    .addServer('/', { url: 'ws://localhost:3001', protocol: 'socket.io' })
    .build();

  const asyncapiDocument = AsyncApiModule.createDocument(app, asyncApiOptions);
  await AsyncApiModule.setup('/asyncapi', app, asyncapiDocument);

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
