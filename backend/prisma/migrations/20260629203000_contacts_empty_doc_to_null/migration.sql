-- Converte CPF/CNPJ/e-mail vazios ("") para NULL.
-- String vazia conta como valor nos índices únicos parciais (WHERE col IS NOT NULL),
-- fazendo dois contatos "sem documento" colidirem. NULL permite vários.
UPDATE "contacts" SET "cnpj" = NULL WHERE "cnpj" = '';
UPDATE "contacts" SET "cpf"  = NULL WHERE "cpf"  = '';
UPDATE "contacts" SET "email" = NULL WHERE "email" = '';
