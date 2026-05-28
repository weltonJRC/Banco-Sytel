# Guia de Deploy - Servidor Próprio JRC

Este documento descreve as etapas necessárias para hospedar e rodar o **Portal CETESB - Retenção Histórica** em um servidor Linux próprio (Ubuntu Server 20.04 ou 22.04 LTS) da infraestrutura da JRC.

---

## 🛠️ Pré-requisitos do Servidor

Certifique-se de que o servidor possui as portas HTTP (`80`) e HTTPS (`443`) liberadas no firewall e os seguintes pacotes instalados:

1. **Node.js** v20.x ou superior.
2. **NPM** v10.x ou superior.
3. **Nginx** (para proxy reverso e SSL).
4. **Git** (para versionamento e clone).

---

## 📦 Etapa 1: Instalação do Node.js e Git

Caso o servidor não possua os pacotes instalados, rode os comandos no terminal Linux:

```bash
# Atualiza pacotes locais
sudo apt update && sudo apt upgrade -y

# Instala curl e git
sudo apt install -y curl git gnupg

# Configura repositório NodeSource para Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Valida versões instaladas
node -v
npm -v
```

---

## 🚀 Etapa 2: Clonando e Configurando a Aplicação

1. **Clonar Repositório**:
   ```bash
   cd /var/www
   sudo git clone <URL_DO_REPOSITORIO_JRC> cetesb-portal
   sudo chown -R $USER:$USER /var/www/cetesb-portal
   cd cetesb-portal
   ```

2. **Configurar Variáveis de Ambiente**:
   - Crie o arquivo `.env` de produção:
     ```bash
     cp .env.example .env
     nano .env
     ```
   - Altere as chaves centrais para desativar os dados mockados:
     ```env
     NEXT_PUBLIC_USE_MOCK_DATA=false
     MOCK_AUTH=false
     
     NEXT_PUBLIC_SUPABASE_URL=https://sua-url-supabase.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
     SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_aqui
     
     APP_NAME="Portal CETESB - Retenção Histórica"
     APP_ENV=production
     PORT=3000
     ```

3. **Instalar Dependências e Criar Build**:
   ```bash
   npm install
   npm run build
   ```

---

## 🤖 Etapa 3: Gerenciamento do Processo com PM2

O **PM2** garante que o servidor Next.js continue rodando em segundo plano e se reinicie automaticamente caso ocorra alguma falha ou reinicialização física do servidor.

1. **Instalar PM2 globalmente**:
   ```bash
   sudo npm install -g pm2
   ```

2. **Iniciar a Aplicação no PM2**:
   ```bash
   pm2 start npm --name "cetesb-portal" -- run start -- -p 3000
   ```

3. **Configurar para Iniciar no Boot**:
   ```bash
   pm2 startup systemd
   # Execute o comando impresso no terminal para configurar o serviço systemd
   
   pm2 save
   ```

---

## 🔒 Etapa 4: Configuração do Proxy Reverso Nginx e SSL (HTTPS)

O Nginx receberá as conexões na porta 80/443 e as redirecionará internamente para o processo do Next.js rodando na porta 3000.

1. **Instalar Nginx**:
   ```bash
   sudo apt install -y nginx
   ```

2. **Criar Configuração do Site**:
   ```bash
   sudo nano /etc/nginx/sites-available/cetesb-portal
   ```
   Cole o seguinte conteúdo (substituindo `cetesb.jrc.com.br` pelo domínio correspondente):
   ```nginx
   server {
       listen 80;
       server_name cetesb.jrc.com.br;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **Ativar o Site e Reiniciar Nginx**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/cetesb-portal /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Instalar Let's Encrypt SSL para HTTPS**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d cetesb.jrc.com.br
   ```
   Siga as instruções na tela e escolha a opção para **redirecionar todo o tráfego HTTP para HTTPS** automaticamente.

---

## 💾 Etapa 5: Rotina de Backup da Base PostgreSQL

Para proteger o histórico unificado CETESB contra desastres, configure backups automáticos da base de dados do Supabase.

1. **Criar script de backup**:
   ```bash
   mkdir -p ~/backups
   nano ~/backups/backup-cetesb.sh
   ```
   Cole o script preenchendo as credenciais de conexão direta do PostgreSQL do Supabase (disponível em `Database Settings` > `Connection String`):
   ```bash
   #!/bin/bash
   BACKUP_DIR="/home/ubuntu/backups"
   DB_URI="postgresql://postgres:SUA_SENHA@db.seu-projeto.supabase.co:5432/postgres"
   DATE=$(date +%Y-%m-%d_%H%M%S)
   FILE="$BACKUP_DIR/cetesb_portal_backup_$DATE.sql"

   # Executa o dump
   pg_dump "$DB_URI" -F c -f "$FILE"

   # Remove backups com mais de 30 dias para economizar espaço
   find "$BACKUP_DIR" -type f -name "*.sql" -mtime +30 -delete
   ```

2. **Tornar o script executável e adicionar no Cron**:
   ```bash
   chmod +x ~/backups/backup-cetesb.sh
   
   # Edita cron jobs do sistema
   crontab -e
   ```
   Adicione a linha abaixo ao final do crontab para rodar o backup **todos os dias à meia-noite**:
   ```cron
   0 0 * * * /home/ubuntu/backups/backup-cetesb.sh > /dev/null 2>&1
   ```
   
O Portal CETESB estará completamente hospedado, protegido por SSL e com rotinas diárias de segurança de dados ativas!
