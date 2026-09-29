# Liga recreativa

Gestão de campeonatos de futebol recreativo: um backoffice para administrar
equipas, jogadores, jogos, regras e desempates, e um portal público onde
qualquer pessoa acompanha a tabela, os resultados e os marcadores em tempo real.

**Stack:** React + Vite + Tailwind, Supabase (base de dados, autenticação,
ficheiros e tempo real) e Cloudflare Pages para o alojamento. Custo: zero nos
planos gratuitos.

## Arrancar (dia 1)

1. **Criar o projeto Supabase** em supabase.com (plano Free).
2. **Criar a base de dados:** no painel, abra *SQL Editor*, cole o conteúdo de
   `supabase/schema.sql` e execute.
3. **Criar o administrador:**
   - *Authentication > Users > Add user*: email e palavra-passe.
   - No *SQL Editor*:
     ```sql
     insert into public.admins (user_id)
     select id from auth.users where email = 'o-seu-email@exemplo.com';
     ```
4. **Configurar o projeto local:**
   ```bash
   cp .env.example .env     # preencher com Project Settings > API
   npm install
   npm run dev
   ```
   Use o *Project URL* e a chave pública (*anon* ou *publishable*). Nunca use a
   chave *service_role* no frontend.
5. Abra `http://localhost:5173/admin`, entre e crie a primeira competição.

## Fluxo de uso

1. **Equipas** e **Jogadores**: registar tudo (emblemas e fotos são reduzidos
   automaticamente antes do envio).
2. **Competições > Nova competição**: escolher o formato (ver abaixo) e definir
   pontos, golos do W.O., ida e volta e a ordem dos critérios de desempate.
3. Marcar as **equipas participantes** (e, nos grupos, **Sortear grupos** ou
   escolher o grupo de cada uma). Em **Datas e horários**, indicar a data
   da primeira jornada, a hora, os minutos entre jogos, os dias entre jornadas
   e o campo. Carregar em **Gerar calendário**: os jogos saem já com data.
   O calendário é substituído numa só transação, por isso um erro nunca deixa
   a competição sem jogos.
4. Mudar o estado para **Em curso**: a competição passa a aparecer no portal.
5. Em cada jogo, lançar o resultado, os golos e os cartões. O portal atualiza
   sozinho.
6. Para remarcar a época a meio (ex.: pausa de duas semanas), use **Marcar
   datas nos jogos por jogar** a partir da jornada certa. Só os jogos agendados
   mudam.

## Formatos de competição

- **Liga**: todos contra todos, uma tabela.
- **Fase de grupos + eliminatórias**: cada grupo joga todos contra todos. No
  fim, **Gerar fase final** coloca os apurados no quadro: 1.º A × 2.º B,
  1.º B × 2.º A, e assim por diante. Grupos × apurados tem de dar 2, 4, 8, 16
  ou 32 equipas.
- **Eliminatórias**: quadro a eliminar desde o início. O campo "Semente" define
  as cabeças de série (1 e 2 só se cruzam na final). Com um número de equipas
  que não é potência de 2, as melhores sementes passam a 1.ª ronda sem jogar.
  As equipas sem semente são sorteadas.

As eliminatórias jogam-se a um só jogo. Num empate, registam-se os penáltis na
ficha do jogo. Quando uma ronda está decidida, o botão **Gerar meias-finais**
(ou quartos, final…) cria a seguinte. Depois, basta marcar as datas no painel
do calendário.

## Portal público

- **Tabela / Grupos / Quadro** (conforme o formato), **Fase final**, **Jogos**
  e **Marcadores**.
- **Página de equipa** (clicar no nome em qualquer tabela ou jogo): posição,
  números da época, próximo jogo, plantel com golos e cartões, e todos os jogos.
- **Página de jogador** (a partir do plantel ou dos marcadores): golos, lugar
  nos marcadores, cartões, suspensão em curso e os golos e cartões jogo a jogo.
  Como não se registam convocatórias, só aparecem os jogos com golos ou cartões.

## Suspensões automáticas

Calculadas a partir dos cartões, com regras definidas em cada competição:

- **Expulsão** (vermelho, ou dois amarelos no mesmo jogo): N jogos (por defeito 1).
  Os amarelos desse jogo não contam para a acumulação.
- **Acumulação de amarelos**: 1 jogo a cada N amarelos (por defeito 3, 6, 9…).
- Cumprem-se nos jogos seguintes da equipa, pela ordem das jornadas. Jogos
  adiados não contam.

A ficha de cada jogo mostra quem está suspenso nessa partida e avisa se um
suspenso tem golos ou cartões registados. A página da competição lista as
suspensões por cumprir. A opção "Suspenso" na ficha do jogador continua a
servir para castigos decididos pela organização.

## Atualizar uma base de dados existente

Se criou a base antes de 29/09/2026, execute uma vez no *SQL Editor*, por esta
ordem, os ficheiros:

1. `supabase/migracoes/2026-09-29_calendario_suspensoes.sql`
2. `supabase/migracoes/2026-09-29_formatos.sql`

## Publicar no Cloudflare Pages (grátis, uso comercial permitido)

1. Suba o código para um repositório GitHub.
2. Cloudflare > *Workers & Pages > Create > Pages > Connect to Git*.
3. Build command: `npm run build`. Output directory: `dist`.
4. Em *Environment variables*, adicione `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`.
5. Cada `git push` publica uma nova versão. O ficheiro `public/_redirects`
   garante que links diretos (ex.: `/c/.../jogos`) funcionam.

## Evitar a pausa do Supabase gratuito

O workflow `.github/workflows/manter-supabase-ativo.yml` faz uma consulta a
cada 3 dias. Basta criar os secrets `SUPABASE_URL` e `SUPABASE_ANON_KEY` em
*GitHub > Settings > Secrets and variables > Actions*.

## Testes

```bash
npm test
```

Cobrem a classificação (incluindo o confronto direto entre 3 equipas, W.O.,
sanções, fair play e sorteio), a geração do calendário e das datas, as
suspensões automáticas e os formatos (quadro, isentos, penáltis, grupos e
rondas seguintes).

## Como funcionam os desempates

A tabela é sempre calculada a partir dos jogos, nunca guardada, por isso
corrigir um resultado corrige a tabela automaticamente.

Os critérios aplicam-se pela ordem definida na competição. No confronto
direto com 3 ou mais equipas empatadas, usa-se uma mini-tabela só com os jogos
entre elas. Se isso separar parte do grupo, o confronto direto é reaplicado
ao subgrupo que continua empatado (regra da UEFA). A razão de cada desempate
aparece na tabela pública, por baixo do nome da equipa.

Fair play: amarelo = 1 ponto, vermelho = 3 (menos é melhor). Se tudo empatar,
vale a ordem de sorteio definida na lista de participantes.

## Estrutura

```
supabase/schema.sql              tabelas, segurança (RLS), funções, storage, tempo real
supabase/migracoes/              alterações para bases já criadas
src/lib/classificacao.ts         motor da tabela e dos desempates
src/lib/calendario.ts            gerador de jornadas (método do círculo) e datas
src/lib/suspensoes.ts            suspensões por cartões
src/lib/formatos.ts              grupos, quadro de eliminatórias e rondas seguintes
src/lib/useDadosCompeticao.ts    carregamento + tempo real + plano B de 30 s
src/paginas/publico/             portal: tabelas, quadro, jogos, marcadores, equipas e jogadores
src/paginas/admin/               backoffice
```

## Segurança

- Leitura pública em tudo o que o portal mostra; escrita só para quem está na
  tabela `admins` (verificado na base de dados pelas políticas RLS).
- Data de nascimento, documento e contacto dos jogadores ficam na tabela
  `jogadores_privado`, que só os administradores conseguem ler.
