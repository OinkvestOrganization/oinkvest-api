# Oinkvest API

Bem-vindo ao repositório do backend da Oinkvest, uma API robusta construída com Nest.js e TypeScript. Este serviço é o coração da nossa aplicação, responsável pela lógica de negócio, persistência de dados e autenticação.

## 📚 Documentação da API

Com o servidor em execução, você pode acessar a documentação interativa da API via Swagger em:

`http://localhost:3001/swagger`
`http://localhost:3001/asyncapi`

Nela você encontrará detalhes sobre todos os endpoints disponíveis, incluindo parâmetros, respostas e exemplos de uso.

---

## 🚀 Como Executar Localmente (Sem Docker)

Siga estes passos para configurar e executar a API diretamente em sua máquina.

### Pré-requisitos

Certifique-se de que você tem as seguintes ferramentas instaladas:

- **Node.js** (versão LTS recomendada)

- **npm** (instalado com o Node.js)

- **PgAdmin, DBeaver** (ou a ferramenta de sua escolha para rodar o banco de dados)

### Instalação

1. Clone este repositório para sua máquina local.

   ```bash
   git clone https://github.com/oinkvest/oinkvest-api.git
   cd oinkvest-api
   ```

2. Limpeza e instalação de dependências:
   Caso você já tenha executado o projeto com o Docker, é recomendável limpar os arquivos gerados.

   ```bash
   # Apaga a pasta de módulos, o diretório de build e logs
   rm -rf node_modules dist npm-debug.log* yarn-debug.log* # Adicione 'sudo' apenas se necessário (por exemplo, se receber erro de permissão)
   # Instala todas as dependências do projeto
   npm install
   ```

3. Configure suas variáveis de ambiente. Crie um arquivo `.env` na raiz do projeto, usando o `.env.example` como modelo.

   ```bash
   cp .env.example .env # Cria o arquivo .env a partir do exemplo
   ```

   Ajuste as variáveis de conexão com o banco de dados conforme a configuração de seu banco de dados local.

### NestJS CLI (Opcional, mas Recomendado)

Se você precisa usar o NestJS CLI para gerar novos arquivos (como módulos, serviços ou controladores), você deve instalá-lo globalmente.

```bash
npm install -g @nestjs/cli
```

Após a instalação, você pode executar comandos como `nest generate service users` para gerar um novo serviço, o que pode agilizar o desenvolvimento.

### Executando a Aplicação

Para iniciar o servidor de desenvolvimento e rodar a aplicação em modo de "watch" (observando alterações de arquivo), execute o comando:

```bash
npm run start:dev
```

Outra opção é usar o comando `nest start --watch` se você tiver o NestJS CLI instalado.
Uma lista com outros scripts úteis está disponível no `package.json` no campo `scripts`.

---

## 🐳 Como Executar com Docker Compose (recomendado)

Recomendamos executar a aplicação via Docker Compose, pois isso simplifica a configuração do ambiente, garante o isolamento das dependências e evita conflitos de versões entre diferentes ambientes de desenvolvimento. Dessa forma, todos os desenvolvedores trabalham em um ambiente padronizado e consistente.

### Pré-requisitos de desenvolvimento

- **Docker** e **Docker Compose** instalados e trocar entrypoint.sh de CRLF para LF.

### Passos

1. Certifique-se de que o arquivo de variáveis de ambiente **`.env`** está configurado com suas variáveis de ambiente local conforme o exemplo em `.env.example`.

   ```bash
   cp .env.example .env # Cria o arquivo .env a partir do exemplo
   ```

2. Inicie os serviços com o Docker Compose. Isso irá construir as imagens a partir do `Dockerfile` do seu projeto e iniciar a API em modo de hot-reload.

   ```bash
   docker compose -f docker-compose.dev.yml up --build -d
   ```

   Para ver os logs e depurar a aplicação, use o seguinte comando:

   ```bash
   docker compose -f docker-compose.dev.yml logs -f
   ```

3. Caso seja a primeira execução, ou se houver mudanças no esquema do banco de dados, execute as migrações e gere o cliente Prisma com os comandos abaixo:

   ```bash
   # Dentro do container
   docker compose -f docker-compose.dev.yml exec app npm run db:migrate        # Aplica as migrações pendentes no banco de dados

   docker compose -f docker-compose.dev.yml exec app npm run prisma:generate   # Gera o cliente Prisma dentro do container

   # Local
   npm run prisma:generate # Gera o cliente Prisma localmente para que a IDE consiga resolver corretamente os imports do Prisma Client em seu ambiente de desenvolvimento
   ```

### Comandos Úteis

- **Parar e remover os contêineres:**

  ```bash
  docker compose -f docker-compose.dev.yml down
  ```

- **Verificar o status dos contêineres:**

  ```bash
  docker ps
  ```

- **Ver logs dos contêineres:**

  ```bash
  docker compose -f docker-compose.dev.yml logs -f
  ```

- **Acessar o shell do contêiner da aplicação:**

  ```bash
  # Exemplo 1: executar uma migração ou comando npm dentro do contêiner
  docker compose -f docker-compose.dev.yml exec app npm run db:migrate

  # Exemplo 2: acessar o shell interativo do contêiner
  docker compose -f docker-compose.dev.yml exec app sh # 'exit' para sair do shell
  ```
