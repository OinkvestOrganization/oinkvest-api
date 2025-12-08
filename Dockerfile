# Stage 1: Imagem de build
FROM node:22.19 AS build

# Define o diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código
COPY . .

COPY entrypoint.sh .

# Gera o Prisma Client
RUN npx prisma generate

# Executa o build do projeto Nest.js
RUN npm run build

# Stage 2: Imagem de produção
FROM node:22.19 AS production

# Instala o cliente do PostgreSQL
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Define o diretório de trabalho
WORKDIR /app

# Define as variáveis de ambiente
ENV NODE_ENV=production

# Copia os arquivos de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

# Copia e torna o entrypoint executável
COPY --from=build /app/entrypoint.sh .
RUN chmod +x entrypoint.sh

# Expõe a porta que o Nest.js usará (padrão 3001)
EXPOSE 3001

# Define o entrypoint e o comando padrão
ENTRYPOINT ["./entrypoint.sh"]
CMD ["start"]
