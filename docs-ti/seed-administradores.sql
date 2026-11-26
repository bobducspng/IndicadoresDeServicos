-- Cadastro inicial de administradores no banco NOVO (rodar UMA vez, depois das migrações).
-- Sem pelo menos um administrador ninguém consegue entrar no site nem cadastrar os demais usuários.
-- Ajuste e-mails/nomes/perfis conforme a Vena. Perfis: 'user', 'admin', 'super_admin'.
-- allowedServices = NULL significa "todos os serviços".
-- Os demais usuários podem ser cadastrados depois, pela tela "Cadastro" do site.

INSERT INTO allowed_users (email, name, role, isActive, allowedServices, addedBy) VALUES
  ('ederlei.pereira@vena.app.br', 'Ederlei Pereira', 'super_admin', 1, NULL, 'seed'),
  ('cancelamento@vena.app.br',    'Cancelamento',    'admin',       1, NULL, 'seed')
ON DUPLICATE KEY UPDATE role = VALUES(role), isActive = 1;

-- A conta bobducs@hotmail.com era administradora no ambiente antigo (conta pessoal, fora do domínio
-- vena.app.br). Só recadastre se a Vena quiser manter esse acesso:
-- INSERT INTO allowed_users (email, name, role, isActive, allowedServices, addedBy)
--   VALUES ('bobducs@hotmail.com', 'bobducs', 'admin', 1, NULL, 'seed')
--   ON DUPLICATE KEY UPDATE role = VALUES(role), isActive = 1;
