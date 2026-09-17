# Deploy automático — GitHub → VM Oracle

Este projeto usa GitHub Actions para publicar a branch `main` na VM Oracle. O workflow está em `.github/workflows/deploy-vm.yml`.

## Arquitetura

```text
WebDev/Manus (fonte de desenvolvimento)
          ↓ push para main
GitHub: bobducspng/IndicadoresDeServicos
          ↓ GitHub Actions via SSH/rsync
VM Oracle: /home/ubuntu/indicadores-servicos
          ↓ pnpm install + check + test + build
systemd: indicadores-servicos.service
          ↓ porta local 3000
ngrok.service → santa-barbed-glorious.ngrok-free.dev
```

O workflow não altera `.env`, `node_modules`, `dist` ou `.git` da VM durante a sincronização. O serviço `ngrok.service` não é reiniciado pelo deploy; somente `indicadores-servicos.service` é reiniciado após todos os testes e o build passarem.

## 1. Preparar a VM

Na VM, o diretório do aplicativo é:

```text
/home/ubuntu/indicadores-servicos
```

O serviço de produção é:

```text
indicadores-servicos.service
```

O usuário `ubuntu` precisa conseguir reiniciar o serviço sem senha, porque o GitHub Actions não pode responder a prompts interativos. Verifique:

```bash
sudo -n systemctl restart indicadores-servicos.service
sudo -n systemctl is-active indicadores-servicos.service
```

Se aparecer erro de senha, configure uma regra sudoers usando o usuário root da VM:

```text
ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart indicadores-servicos.service, /usr/bin/systemctl is-active indicadores-servicos.service
```

Depois teste novamente os dois comandos. Não coloque o conteúdo do `.env` no GitHub.

## 2. Preparar a chave SSH de deploy

Na VM, como usuário `ubuntu`, gerar uma chave exclusiva para o GitHub Actions:

```bash
ssh-keygen -t ed25519 -C "github-actions-indicadores-servicos" -f ~/.ssh/github_actions_indicadores
cat ~/.ssh/github_actions_indicadores.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_actions_indicadores
```

O último comando exibe a chave privada. Ela deve ser copiada diretamente para o secret `VM_SSH_KEY` do GitHub e **nunca** enviada no chat ou commitada no repositório. Depois de copiar, limpe o terminal se necessário.

Descobrir o IP público ou hostname SSH da VM:

```bash
curl -4 https://ifconfig.me
```

Descobrir a chave pública do servidor para `known_hosts`:

```bash
ssh-keyscan -H -p 22 SEU_IP_PUBLICO
```

Prefira executar `ssh-keyscan` em uma máquina confiável e revisar a chave antes de usá-la no GitHub.

A porta TCP 22 precisa estar liberada no Security List/NSG da Oracle Cloud e no firewall da VM. Não abra portas desnecessárias.

## 3. Configurar secrets no GitHub

No repositório `bobducspng/IndicadoresDeServicos`, acessar:

```text
Settings → Secrets and variables → Actions → New repository secret
```

Criar estes secrets:

| Secret | Valor |
|---|---|
| `VM_HOST` | IP público ou hostname SSH da VM. |
| `VM_PORT` | `22` ou a porta SSH configurada. Pode ser omitido; o workflow usa 22. |
| `VM_USER` | `ubuntu` |
| `VM_APP_PATH` | `/home/ubuntu/indicadores-servicos` |
| `VM_SSH_KEY` | Conteúdo privado de `~/.ssh/github_actions_indicadores`, incluindo BEGIN/END. |
| `VM_KNOWN_HOSTS` | Saída revisada de `ssh-keyscan -H -p 22 SEU_IP_PUBLICO`. |

Não criar secret para `.env`; o `.env` permanece somente na VM.

## 4. Fazer o primeiro push

O repositório GitHub foi criado, mas estava vazio. A primeira versão deve ser a versão atual do WebDev. Depois de colocar o pacote portátil atualizado na VM, preservar o `.env` e executar:

```bash
cd /home/ubuntu/indicadores-servicos

# Se ainda não houver Git local:
git init
git branch -M main
git remote add origin https://github.com/bobducspng/IndicadoresDeServicos.git

# Confirmar que .env está ignorado e não será incluído:
git status --short --ignored | grep -E '(^|/)\.env' || true

# Conferir arquivos antes do primeiro envio:
git add .
git diff --cached --stat
git diff --cached --name-only | grep -E '(^|/)\.env|\.project-config' && echo 'ERRO: segredo staged' && git reset || true

git commit -m "chore: versão inicial do Indicadores de Serviços"
git push -u origin main
```

Se o GitHub solicitar autenticação HTTPS, use `gh auth login` ou configure uma chave SSH da conta. Não coloque senha ou token dentro da URL do remote.

Antes do push, confirmar que `.env` não aparece em `git diff --cached --name-only`.

## 5. Funcionamento dos próximos deploys

Cada push em `main` dispara `.github/workflows/deploy-vm.yml`. O job:

1. baixa o commit;
2. abre SSH usando os secrets;
3. sincroniza arquivos por `rsync`, sem tocar no `.env`;
4. executa `pnpm install --frozen-lockfile`;
5. executa `pnpm check`;
6. executa `pnpm test`;
7. executa `pnpm build`;
8. reinicia `indicadores-servicos.service`;
9. verifica o status systemd e `http://127.0.0.1:3000/`.

Se qualquer etapa falhar, o serviço em execução não é reiniciado pelo workflow. Consulte a aba **Actions** do GitHub.

## 6. Fluxo de publicação no domínio Manus

O domínio `servicendex-ekyyhrhe.manus.space` continua sendo publicado pelo WebDev/Manus por checkpoint/publicação. O GitHub Actions atualiza a VM Oracle; ele não publica automaticamente no domínio Manus.

Fluxo recomendado para uma alteração feita no WebDev:

```text
1. Alterar e testar no WebDev
2. Salvar checkpoint
3. Publicar/atualizar o domínio Manus
4. Enviar o mesmo commit para GitHub/main
5. GitHub Actions atualizar a VM Oracle
6. Validar o domínio ngrok
```

Para evitar divergência, o commit enviado ao GitHub deve ser exatamente o mesmo estado validado no WebDev. Não desenvolver simultaneamente diretamente na VM e no WebDev.

## 7. Segurança e manutenção

- Nunca versionar `.env`, chaves privadas, tokens, dumps do banco ou `.project-config.json`.
- Rotacione a chave `github_actions_indicadores` se ela for exposta.
- Mantenha o SSH restrito por firewall e, se possível, por IPs do GitHub Actions usando uma solução adequada ao ambiente.
- O ngrok é um túnel de acesso, não uma hospedagem permanente; o domínio pode mudar de disponibilidade conforme a conta/plano e o serviço.
- Para produção estável, usar domínio próprio apontado para um proxy reverso na VM, mantendo ngrok somente para testes.
