# Pacote portátil — Indicadores de Serviços

**Gerado em:** 17/09/2026  
**Destino:** continuidade do desenvolvimento no Claude e inicialização do deploy na VM Oracle  
**Projeto:** Indicadores de Serviços  
**Último checkpoint WebDev:** `45810384`

## Incluído

O pacote contém o código-fonte completo, frontend React/TypeScript, backend Express/tRPC, schema Drizzle, todas as migrações SQL, testes, snapshot local da planilha, documentação técnica, manual de indicadores, assets portáteis e o workflow de deploy automático:

```text
.github/workflows/deploy-vm.yml
```

Arquivos de orientação:

- `README.md` — início rápido, rotas, arquitetura e referência de deploy.
- `CONTINUAR_COM_OUTRA_IA.md` — guia completo para o Claude continuar o projeto.
- `MANUAL_INDICADORES.md` — abas, campos, gráficos e regras de negócio.
- `DEPLOY_VM.md` — configuração GitHub Actions → VM Oracle → systemd/ngrok.
- `portable-assets/` — ícones locais para migrar o site sem os caminhos `/manus-storage`.

## Não incluído por segurança e portabilidade

- `node_modules/` — reinstalar com `pnpm install --frozen-lockfile`.
- `dist/` — regenerar com `pnpm build`.
- `.git/` e logs locais.
- `.project-config.json`, `.env*`, tokens, URLs de banco e segredos WebDev.
- `client/public/__manus__/` — instrumentação específica do WebDev.

O banco de produção e a tabela `allowed_users` não são exportados para o ZIP. Para preservar os acessos em outra hospedagem, exporte e importe a whitelist por canal seguro.

## Primeiros comandos no Claude

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Antes de alterar indicadores, leia `CONTINUAR_COM_OUTRA_IA.md` e `MANUAL_INDICADORES.md`. Para configurar a atualização automática da VM, leia `DEPLOY_VM.md`. Nunca copie segredos do ambiente original para o repositório.
