# DeepTutor como extensao opcional do Study OS

## Decisao
DeepTutor (HKUDS/DeepTutor) e um projeto de tutor por IA, diferente do nucleo espacial e local-first do Study OS. Manter como repositorio separado para preservar a identidade, o historico e a primeira release **sem IA**. Nenhuma dependencia ou chamada de modelo foi adicionada ao Study OS.

## Fork e upstream

O conector GitHub usado na preparacao inicial nao dispoe de uma acao de *fork*. Fazer o fork autentico no GitHub (nao copiar arquivos para dentro de `study-os`):

1. Entrar em https://github.com/HKUDS/DeepTutor e clicar **Fork**.
2. Selecionar a conta `IgorAmoras`; preservar o historico e a licenca Apache-2.0.
3. Conferir que o repositorio **IgorAmoras/DeepTutor** foi criado.
4. No PC, se desejar desenvolver o fork: `git clone https://github.com/IgorAmoras/DeepTutor.git` e, dentro da pasta, `git remote add upstream https://github.com/HKUDS/DeepTutor.git`.

Opcional para quem ja instalou e autenticou GitHub CLI: `gh repo fork HKUDS/DeepTutor --clone=false`. Nao adicionar como submodulo de `study-os` antes de estabelecer um contrato de integracao claro.

## Estrategia de integracao futura
- Study OS segue responsavel por home, cosmos, bancada, PDF, canvas infinito, sync da S Pen e repositorios cientificos locais.
- DeepTutor fica como ferramenta separada de tutoria, bases de conhecimento e experimentos com agentes.
- Integracao futura **opt-in**, via link/launcher ou API isolada (sujeita a validacao); nao habilitar agentes ou gastos com APIs na primeira release.
- Nunca copiar chaves, tokens, documentos privados ou pastas de dados de runtime para GitHub.
- Verificar licencas e avisos de terceiros antes de redistribuir componentes.
- Releases desktop do DeepTutor podem ser nao assinadas; revisar origem e permissões antes de executar.

Referencia: https://github.com/HKUDS/DeepTutor
