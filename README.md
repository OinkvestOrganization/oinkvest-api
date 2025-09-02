# Oinkvest API

Bem-vindo ao repositório do backend da Oinkvest, uma API robusta construída com Nest.js e TypeScript. Este serviço é o coração da nossa aplicação, responsável pela lógica de negócio, persistência de dados e autenticação.

## 🚀 Como Executar Localmente (Sem Docker)

Siga estes passos para configurar e executar a API diretamente em sua máquina.

### Pré-requisitos

Certifique-se de que você tem as seguintes ferramentas instaladas:

* **Node.js** (versão LTS recomendada)

* **npm** (instalado com o Node.js)

* **pgadmin, dbeaver** (ou a ferramenta de sua escolha para rodar o banco de dados)

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
    sudo rm -rf node_modules dist npm-debug.log* yarn-debug.log*
    # Instala todas as dependências do projeto
    npm install
    ```

3. Configure suas variáveis de ambiente. Crie um arquivo `.env` na raiz do projeto, usando o `.env.example` como modelo.

    ```bash
    cp .env.example .env
    ```

    Ajuste as variáveis de conexão com o banco de dados conforme sua configuração local.

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

A API estará disponível em `http://localhost:3001`.

-----

## 🐳 Como Executar com Docker Compose

Esta seção é para colaboradores que preferem usar o ambiente Docker. Para um setup rápido, use o arquivo `docker-compose.yml` no repositório **`oinkvest-devops`**.

### Pré-requisitos de desenvolvimento

* **Docker** e **Docker Compose** instalados.

### Passos

1. Certifique-se de que o arquivo de variáveis de ambiente **`.env`** está configurado conforme o exemplo em `.env.example`.
  
    ```bash
    cp .env.example .env
    ```

2. Inicie os serviços com o Docker Compose. Isso irá construir as imagens a partir do `Dockerfile` do seu projeto e iniciar a API em modo de hot-reload.

    ```bash
    docker compose up -f docker-compose.dev.yml --build -d
    ```

    Para ver os logs e depurar a aplicação, use o seguinte comando:

    ```bash
    docker compose logs -f docker-compose.dev.yml -f
    ```

3. Caso seja feita alguma alteração no `schema.prisma` que mude as migrations no banco é preciso executar `npm run db:migrate` e `npm run prisma:generate` tanto localmente quanto dentro do container:

    ```bash
    # Dentro do container
    docker-compose -f docker-compose.dev.yml exec app npm run db:migrate

    docker-compose -f docker-compose.dev.yml exec app npm run prisma:generate

    # Local
    npm run db:migrate
    npm run prisma:generate
    ```

### Comandos Úteis

* **Parar e remover os contêineres:**

  ```bash
  docker compose -f docker-compose.dev.yml down
  ```

* **Verificar o status dos contêineres:**

  ```bash
  docker ps
  ```

## 📚 Documentação da API

Acesse a documentação da API em tempo real (Swagger) em `http://localhost:3001/swagger`.
