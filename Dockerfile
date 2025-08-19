# Stage 1: Imagem de build
FROM node:18-alpine AS build

# Define o diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código
COPY . .

# Executa o build do projeto Nest.js
RUN npm run build

# Stage 2: Imagem de produção
FROM node:18-alpine AS production

# Define o diretório de trabalho
WORKDIR /app

# Define as variáveis de ambiente
ENV NODE_ENV=production

# Copia apenas os arquivos necessários para rodar a aplicação
# O Nest.js compila o código para a pasta 'dist'
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Expõe a porta que o Nest.js usará (padrão 3001)
EXPOSE 3001

# Comando para iniciar o servidor Nest.js
CMD ["node", "dist/main"]
