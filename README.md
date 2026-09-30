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
5. Abra `http://localhost:5173/entrar`, entre e crie a primeira competição.

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
5. Em cada jogo, preencher a **ficha de jogo** (quem joga), lançar o resultado,
   os golos e os cartões. O portal atualiza sozinho.
6. Para remarcar a época a meio (ex.: pausa de duas semanas), use **Marcar
   datas nos jogos por jogar** a partir da jornada certa. Só os jogos agendados
   mudam.

## Formatos de competição

- **Liga**: todos contra todos, uma tabela.
- **Fase de grupos + eliminatórias**: cada grupo joga todos contra todos. No
  fim, **Gerar fase final** coloca os apurados no quadro: 1.º A × 2.º B,
  1.º B × 2.º A, e assim por diante. Grupos × apurados (mais os melhores
  terceiros, se houver) tem de dar 2, 4, 8, 16 ou 32 equipas.
- **Melhores terceiros**: em "Melhores 3.º classificados também passam",
  indique quantos. Comparam-se entre grupos por pontos, diferença de golos,
  golos marcados, vitórias, fair play e sorteio. Se os grupos tiverem tamanhos
  diferentes, não contam os jogos contra os últimos dos grupos maiores (como na
  UEFA). O ranking aparece no portal, por baixo dos grupos. No quadro, a 1.ª
  ronda evita jogos entre equipas do mesmo grupo. (Ex.: 3 grupos × 2 apurados
  + 2 melhores terceiros = 8; 6 grupos × 2 + 4 = 16.)
- **Eliminatórias**: quadro a eliminar desde o início. O campo "Semente" define
  as cabeças de série (1 e 2 só se cruzam na final). Com um número de equipas
  que não é potência de 2, as melhores sementes passam a 1.ª ronda sem jogar.
  As equipas sem semente são sorteadas.

Por defeito, as eliminatórias jogam-se a um só jogo, e um empate decide-se nos
penáltis registados na ficha do jogo. Nas regras da competição, em
**Eliminatórias**, pode escolher:

- **A duas mãos**: dois jogos por eliminatória, com os golos somados e sem regra
  dos golos fora. A 1.ª mão joga-se em casa da equipa pior classificada no
  quadro e a 2.ª, na jornada seguinte, em casa da melhor. Se o total empatar,
  registam-se os penáltis na ficha da 2.ª mão, onde aparece o total das duas.
  Um W.O. conta com os golos definidos nas regras. A final é a um só jogo, a
  não ser que marque "A final também a duas mãos".
- **Jogo do 3.º lugar**: os derrotados das meias-finais jogam no dia da final
  (na 2.ª mão, se a final tiver duas). Gera-se com a final.

Quando uma ronda está decidida, o botão **Gerar meias-finais** (ou quartos,
final…) cria a seguinte. Depois, basta marcar as datas no painel do calendário.
As regras aplicam-se às rondas que ainda vão ser geradas.

## Portal público

- **Página inicial**: todas as competições em curso, com pesquisa por nome ou
  época. A ☆ marca uma competição como favorita, e as favoritas aparecem
  primeiro nas visitas seguintes (ficam guardadas no próprio browser). As
  terminadas estão numa secção à parte.
- **Ao vivo**: os jogos a decorrer aparecem em "Ao vivo agora" na página
  inicial (os das competições favoritas primeiro) e numa faixa no topo da
  competição, com o resultado e o minuto, atualizados em tempo real.
- **Página do jogo** (tocar num jogo em qualquer lista): marcador, golos e
  cartões com o minuto, de cada lado, e os convocados. Durante o jogo
  atualiza-se sozinha.
- **Tabela / Grupos / Quadro** (conforme o formato), **Fase final**, **Jogos**
  e **Marcadores**.
- **Página de equipa** (clicar no nome em qualquer tabela ou jogo): posição,
  números da época, próximo jogo, plantel com golos e cartões, e todos os jogos.
- **Página de jogador** (a partir do plantel ou dos marcadores): golos, lugar
  nos marcadores, cartões, suspensão em curso e os jogos disputados, com os
  golos e cartões de cada um.

## Modo jogo (lançar no campo)

Para lançar o jogo à medida que acontece, no telemóvel:

1. No backoffice, **No campo** mostra os jogos a decorrer e os de hoje (ou, na
   ficha de qualquer jogo, **Modo jogo**).
2. **Começar o jogo** põe o relógio a andar. O público passa a ver o jogo "Ao
   vivo", com o resultado e o minuto.
3. Em cada equipa: **Golo**, **Amarelo**, **Vermelho** ou **Autogolo**, e depois
   o jogador (dos convocados da ficha, ou do plantel se a ficha estiver vazia).
   O minuto vem preenchido e pode ser corrigido. Suspensos e expulsos aparecem
   assinalados.
4. **Intervalo** para o relógio; **Começar a 2.ª parte** continua a partir do
   minuto em que parou; **Terminar o jogo** pede confirmação e fecha a partida.
   Numa eliminatória empatada, pede logo os penáltis.

O resultado é sempre o dos golos registados. Um engano corrige-se com
**Anular** (dois toques). O relógio fica guardado na base de dados: bloquear o
telemóvel ou fechar a app não o estraga.

**Rede fraca:** cada golo ou cartão aparece logo e fica numa fila (guardada no
telemóvel) até ser gravado. Sem rede, fica "por enviar" e é enviado sozinho
quando a ligação volta, sem duplicar. Só se pode terminar o jogo com a fila
vazia. Durante o jogo, o ecrã não se apaga (nos telemóveis que o permitem).

## Notificações

Quem acompanha a liga recebe no telemóvel:

- **Golos** dos jogos a decorrer (com o resultado, o minuto e o marcador);
- **Início e fim** de cada jogo (com o resultado final);
- **Jogos marcados ou remarcados**. Marcar várias datas de uma vez gera uma
  só notificação de resumo por pessoa.

No portal, o **sino** no topo de uma competição ativa as notificações de todos
os jogos; **Seguir** na página de uma equipa, só dos jogos dela. Cada pessoa
escolhe os tipos de aviso. No iPhone só funciona com a app instalada no ecrã
principal (iOS 16.4 ou mais recente). Competições em rascunho nunca notificam.

**Como funciona:** a base de dados (gatilhos + extensão `pg_net`) avisa a
função `functions/api/notificar.ts`, publicada pelo Cloudflare Pages com o
site, que cifra e envia cada notificação (Web Push). A chave secreta do
Supabase fica só no Cloudflare.

**Configuração (uma vez):**

1. No SQL Editor, execute `supabase/migracoes/2026-10-03_notificacoes.sql`.
2. No seu computador, gere o par de chaves VAPID:
   ```bash
   npx web-push generate-vapid-keys
   ```
   A chave pública vai para a app; a privada fica só no Cloudflare.
3. No ficheiro `.env`, acrescente `VITE_VAPID_PUBLIC_KEY=` com a chave pública.
4. No Cloudflare Pages, *Settings > Variables and Secrets* (Production):

   | Nome | Tipo | Valor |
   |---|---|---|
   | `VITE_VAPID_PUBLIC_KEY` | Texto | a chave pública |
   | `VAPID_PUBLIC_KEY` | Texto | a chave pública (outra vez) |
   | `VAPID_PRIVATE_KEY` | Secret | a chave privada |
   | `VAPID_SUBJECT` | Texto | `mailto:` + o seu email |
   | `SUPABASE_URL` | Texto | o endereço do projeto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase > *Project Settings > API Keys*: a chave **secret** (ou a antiga `service_role`) |
   | `NOTIFICAR_SEGREDO` | Secret | um texto longo e aleatório, inventado por si |
   | `FUSO_HORARIO` | Texto (opcional) | por defeito `Africa/Maputo` |

   Depois, em *Deployments*, volte a publicar a última versão (**Retry
   deployment**), para a app ganhar a chave pública.
5. No SQL Editor do Supabase, diga à base de dados para onde enviar (o mesmo
   segredo do passo 4):
   ```sql
   update public.config_notificacoes
      set url = 'https://a-sua-liga.pages.dev/api/notificar',
          segredo = 'O-MESMO-NOTIFICAR_SEGREDO';
   ```
6. Teste: no telemóvel, toque no sino de uma competição e ative; depois comece
   um jogo no modo jogo.

Enquanto os passos 4 e 5 não estiverem feitos, o sino não aparece (sem chave
pública) ou a base de dados simplesmente não pede envios. Nada falha por isso.

## App no telemóvel (PWA)

O portal instala-se como uma app, sem loja de aplicações:

- **Android** (Chrome): aparece um cartão **Instalar** na página inicial.
- **iPhone** (Safari): **Partilhar ▸ Adicionar ao ecrã principal** (o cartão
  explica).
- **Computador** (Chrome/Edge): ícone de instalar na barra de endereço.

Depois de instalada:

- Abre sem rede, com os últimos dados vistos (tabelas, jogos, marcadores,
  emblemas e fotos). Aparece o aviso "Sem ligação".
- Os dados pessoais dos jogadores e os emails dos responsáveis nunca ficam
  guardados no aparelho. Entrar, lançar resultados e gravar continuam a precisar
  de rede.
- Quando há uma versão nova do site, aparece **Nova versão disponível ·
  Atualizar**. A app não recarrega sozinha, para não perder um formulário a meio.

O ficheiro `public/_headers` impede que o Cloudflare guarde em cache o service
worker, para as atualizações chegarem logo.

## Área da equipa (responsáveis)

Cada equipa pode ter responsáveis que gerem o próprio plantel e as fichas de
jogo, para a organização não ter de o fazer por todos.

1. No backoffice, em **Equipas > Editar**, escreva o email do responsável em
   **Acesso à área da equipa**.
2. O responsável abre `/entrar` (há um link no fundo da página inicial),
   escolhe **Criar conta** com esse email e confirma-o no email que recebe.
3. A partir daí, ao entrar, vai para a **área da equipa**: próximos jogos com a
   ficha de cada um, e o plantel (acrescentar e editar jogadores, com foto e
   dados pessoais).

O responsável **não** pode lançar resultados, golos ou cartões, suspender
jogadores, apagar jogadores ou mudá-los de equipa, mexer noutras equipas, nem
alterar a ficha depois de o jogo terminar. Estas regras estão na base de dados
(RLS), não só nos ecrãs.

**Importante no Supabase:**
- *Authentication > Sign In / Providers > Email*: mantenha **Confirm email**
  ligado. O acesso só é dado a emails confirmados; sem confirmação, qualquer
  pessoa podia criar conta com o email de um responsável.
- *Authentication > URL Configuration*: em **Site URL** ponha o endereço do
  site (ex.: `https://a-sua-liga.pages.dev`) e acrescente em **Redirect URLs**
  `https://a-sua-liga.pages.dev/entrar` (confirmação da conta) e
  `https://a-sua-liga.pages.dev/entrar/nova-palavra-passe` (recuperar a
  palavra-passe), para os links dos emails voltarem ao site.

**Esqueceu-se da palavra-passe?** Em `/entrar`, **Esqueci-me da palavra-passe**
envia um link (válido uma hora) para escolher uma nova. Quem já tem sessão muda
a palavra-passe no link **Palavra-passe** do menu.
- O envio de emails incluído no plano gratuito só permite poucos emails por
  hora. Chega para alguns responsáveis; para muitos, configure um SMTP próprio
  em *Authentication > Emails*.

## Fichas de jogo

Na página de cada jogo, a **ficha de jogo** regista quem joga por cada equipa.
Cada alteração fica gravada logo.

- **Copiar do jogo anterior** marca quem jogou no último jogo da equipa.
  **Todos os disponíveis** marca o plantel inteiro. Em ambos, os suspensos
  ficam de fora.
- Os suspensos (por cartões ou por decisão da organização) aparecem
  bloqueados, com o motivo.
- Nos golos e cartões, só aparecem os convocados da equipa.
- Há aviso quando um suspenso ficou na ficha, ou quando alguém tem golos ou
  cartões sem estar na ficha.
- Estar na ficha de um jogo terminado conta como jogo disputado (num W.O.
  ninguém jogou). Aparece nas páginas de jogador e de equipa.

## Imagens para partilhar

Na página da competição, **Imagens para partilhar** cria uma imagem com os
**resultados** de uma jornada (ou ronda) ou com os **próximos jogos**, com
emblemas, data, hora e campo. Por defeito aparece a última jornada com
resultados ou a próxima com jogos por fazer, e a imagem atualiza-se quando
entra um resultado.

- **Partilhar**: no telemóvel abre a lista de apps (WhatsApp, etc.).
- **Copiar imagem**: no computador, para colar no WhatsApp Web.
- **Descarregar PNG** e **Copiar texto** (a mesma informação em texto, para a
  mensagem).

O rodapé mostra o endereço do portal definido em `VITE_SITE_URL`.

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
3. `supabase/migracoes/2026-09-30_fichas_jogo.sql`
4. `supabase/migracoes/2026-09-30_responsaveis.sql`
5. `supabase/migracoes/2026-10-01_eliminatorias.sql`
6. `supabase/migracoes/2026-10-02_modo_jogo.sql`
7. `supabase/migracoes/2026-10-03_notificacoes.sql`

## Publicar no Cloudflare Pages (grátis, uso comercial permitido)

1. Suba o código para um repositório GitHub.
2. Cloudflare > *Workers & Pages > Create > Pages > Connect to Git*.
3. Build command: `npm run build`. Output directory: `dist`.
4. Em *Environment variables*, adicione `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` e `VITE_SITE_URL` (o endereço do site, ex.:
   `https://a-sua-liga.pages.dev`, que aparece nas imagens para partilhar).
5. Cada `git push` publica uma nova versão. O ficheiro `public/_redirects`
   garante que links diretos (ex.: `/c/.../jogos`) funcionam.

## Cópias de segurança

O plano gratuito do Supabase **não faz cópias de segurança**. Há duas formas de
as ter:

**1. Automática, todas as semanas (toda a base de dados).** O workflow
`.github/workflows/copia-de-seguranca.yml` corre às segundas-feiras de
madrugada e guarda a cópia durante 90 dias em *GitHub > Actions > Cópia de
segurança > (execução) > Artifacts*. Configuração, uma vez:

1. No Supabase, **Connect** (no topo do projeto) > **Session pooler** > copie
   o URI e substitua `[YOUR-PASSWORD]` pela palavra-passe da base de dados
   (*Project Settings > Database*, onde também a pode redefinir).
2. No GitHub, *Settings > Secrets and variables > Actions*, crie:
   - `SUPABASE_DB_URL`: o URI do passo anterior;
   - `BACKUP_PASSPHRASE`: uma palavra-passe forte para cifrar as cópias.
     **Guarde-a fora do GitHub**: sem ela, as cópias não abrem.
3. Em *Actions > Cópia de segurança > Run workflow*, faça a primeira cópia
   para confirmar que funciona.

A cópia vai sempre **cifrada** (AES-256), porque tem dados pessoais dos
jogadores e os artefactos de um repositório público podem ser descarregados por
qualquer pessoa. Não inclui as fotos e os emblemas (ficam no armazenamento de
ficheiros do Supabase).

Para restaurar (num projeto Supabase novo ou no mesmo):

```bash
gpg -d liga-AAAA-MM-DD.tar.gz.gpg | tar -xz      # pede a BACKUP_PASSPHRASE
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file copia/roles.sql --file copia/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file copia/data.sql \
  --dbname "URI-DO-PROJETO-DE-DESTINO"
```

(É o procedimento oficial do Supabase: *Backup and restore using the CLI*.)

**2. Manual, por competição.** No backoffice, separador **Configuração** >
**Exportar dados**: **Descarregar tudo (JSON)** guarda a competição inteira
(equipas, jogadores, jogos, golos, cartões, fichas e sanções); **Resultados
para o Excel (CSV)** dá uma tabela com todos os jogos. Os dados pessoais só vão
se marcar a opção.

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
src/lib/partilha.ts              imagens e texto para partilhar
src/lib/aoVivo.ts                modo jogo: relógio, marcador e expulsões
src/lib/exportar.ts              exportar para JSON e CSV (Excel)
src/lib/notificacoes.ts          notificações: texto dos avisos e quem os recebe
functions/api/notificar.ts       servidor (Cloudflare): envia as notificações push
src/lib/fichas.ts                fichas de jogo: copiar a anterior, jogos disputados
src/lib/useDadosCompeticao.ts    carregamento + tempo real + plano B de 30 s
src/paginas/publico/             portal: tabelas, quadro, jogos, marcadores, equipas e jogadores
src/lib/sessao.ts                quem tem sessão: administrador, responsável ou sem acesso
src/lib/useFichaJogo.ts          dados e ações da ficha de jogo (backoffice e área da equipa)
src/lib/favoritos.ts             favoritos e pesquisa da página inicial
src/paginas/admin/               backoffice
src/paginas/equipa/              área dos responsáveis de equipa
```

## Segurança

- Leitura pública em tudo o que o portal mostra; escrita só para quem está na
  tabela `admins` (verificado na base de dados pelas políticas RLS).
- Responsáveis de equipa (tabela `responsaveis`, por email confirmado) só
  escrevem no plantel e nas fichas de jogo da própria equipa. Suspender
  jogadores continua reservado aos administradores (trigger na base de dados).
- Data de nascimento, documento e contacto dos jogadores ficam na tabela
  `jogadores_privado`, que só os administradores e o responsável da equipa do
  jogador conseguem ler. Os emails dos responsáveis só os administradores veem.
