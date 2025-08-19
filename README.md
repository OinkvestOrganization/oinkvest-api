# Oinkvest API

Bem-vindo ao repositório do backend da Oinkvest, uma API robusta construída com Nest.js e TypeScript. Este serviço é o coração da nossa aplicação, responsável pela lógica de negócio, persistência de dados e autenticação.

## 🚀 Como Executar Localmente (Ambiente de Desenvolvimento)

Siga estes passos para configurar e executar a API em sua máquina.

### Pré-requisitos

Certifique-se de que você tem as seguintes ferramentas instaladas:

  * **Node.js** (versão LTS recomendada)
  * **npm** (instalado com o Node.js)
  * **PostgreSQL** (ou a ferramenta de sua escolha para rodar o banco de dados)

### Instalação

1.  Clone este repositório para sua máquina local.

    ```bash
    git clone https://github.com/oinkvest/oinkvest-api.git
    cd oinkvest-api
    ```

2.  Instale todas as dependências do projeto.

    ```bash
    npm install
    ```

3.  Configure suas variáveis de ambiente. Crie um arquivo `.env` na raiz do projeto, usando o `.env.example` como modelo.

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

## 🐳 Executando com Docker

Se você prefere um ambiente de desenvolvimento isolado ou quer criar a imagem para deploy, siga as instruções abaixo.

### Pré-requisitos

  * **Docker** e **Docker Compose** instalados.

### 1\. Criando a Imagem Docker

A partir da raiz deste repositório, execute o seguinte comando para construir a imagem Docker. A flag `-t` cria uma "tag" (nome) para a imagem, facilitando a sua identificação.

```bash
docker build -t oinkvest-api:latest .
```

### 2\. Executando o Contêiner

Para rodar o contêiner a partir da imagem que você acabou de criar, use o comando `docker run`. Mapeamos a porta 3001 do contêiner para a porta 3001 da sua máquina local.

```bash
docker run -p 3001:3001 --name oinkvest-api-container oinkvest-api:latest
```

A aplicação agora está rodando em um contêiner Docker, acessível em `http://localhost:3001`. Você pode verificar o status do contêiner com `docker ps`.

### Comandos Úteis do Docker

  * **Parar o contêiner:**
    ```bash
    docker stop oinkvest-api-container
    ```
  * **Remover o contêiner:**
    ```bash
    docker rm oinkvest-api-container
    ```
  * **Ver os logs:**
    ```bash
    docker logs oinkvest-api-container
    ```

## 📚 Documentação da API

Acesse a documentação da API em tempo real (Swagger) em `http://localhost:3001/api`. (ainda não implementado)