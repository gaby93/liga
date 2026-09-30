import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { BotaoConvidar, CodigoQR } from '../../componentes/Convidar';
import { Botao, Marca } from '../../componentes/ui';
import { adicionarFavorito } from '../../lib/favoritos';
import { abrirNoChrome, plataformaAtual, useInstalar, type Plataforma } from '../../lib/instalar';
import { supabase } from '../../lib/supabase';

/** Página de destino dos convites: explica como instalar a app neste aparelho. */
export default function Instalar() {
  const [params] = useSearchParams();
  const competicaoId = params.get('c') ?? undefined;
  const [nome, setNome] = useState<string | null>(null);
  const { podeInstalar, instalada, instalar } = useInstalar();
  const [p] = useState<Plataforma>(plataformaAtual);
  const destino = competicaoId ? `/c/${competicaoId}` : '/';

  useEffect(() => {
    if (!competicaoId) return;
    // A competição do convite fica nos favoritos: aparece no topo quando abrir a app
    adicionarFavorito(competicaoId);
    supabase.from('competicoes').select('nome').eq('id', competicaoId).maybeSingle()
      .then(({ data }) => setNome((data as { nome: string } | null)?.nome ?? null));
  }, [competicaoId]);

  // Aberta já como app (o iPhone abre a página onde foi adicionada): segue para a competição
  if (p === 'instalada') return <Navigate to={destino} replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="faixa px-4 text-white">
        <div className="mx-auto max-w-xl">
          <div className="flex h-14 items-center"><Link to="/" className="hover:opacity-80"><Marca clara /></Link></div>
          <div className="pb-8 pt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/65">Convite</p>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
              {nome ? <>Acompanhe a {nome} no telemóvel</> : 'Tenha a liga no telemóvel'}
            </h1>
            <p className="mt-2 text-white/80">Resultados ao vivo, tabelas, marcadores e avisos de golos. É grátis e ocupa pouco espaço.</p>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
        <section className="rounded-2xl border border-linha bg-white p-5 shadow-cartao">
          {instalada ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">App instalada ✓</h2>
              <p className="text-sm text-tinta/70">Abra-a pelo ícone <strong>Liga</strong> no ecrã principal.</p>
            </div>
          ) : (
            <Passos plataforma={p} podeInstalar={podeInstalar} instalar={instalar} />
          )}
        </section>

        <section className="rounded-2xl border border-linha bg-white p-5 text-sm shadow-cartao">
          <h2 className="mb-2 font-semibold">Depois de instalar</h2>
          <p className="text-tinta/70">
            Abra {nome ? `a ${nome}` : 'a sua competição'} e toque no <strong>sino</strong> 🔔 no topo para receber avisos de golos,
            do início e do fim dos jogos. Numa equipa, toque em <strong>Seguir</strong> para receber só os jogos dela.
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={destino} className="text-sm font-semibold text-relva hover:underline">
            {nome ? `Ver a ${nome} sem instalar ›` : 'Continuar sem instalar ›'}
          </Link>
          <BotaoConvidar competicaoId={competicaoId} nome={nome ?? undefined} />
        </div>
      </main>
    </div>
  );
}

function Passo({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-relva/10 text-sm font-semibold text-relva">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function Lista({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <ol className="flex flex-col gap-3 text-sm">{children}</ol>
    </div>
  );
}

const PasseAbrir = <Passo n={4}>Abra a app pelo ícone <strong>Liga</strong> no ecrã principal.</Passo>;

function CopiarLink() {
  const [feito, setFeito] = useState(false);
  return (
    <Botao variante="secundario" onClick={async () => {
      try { await navigator.clipboard.writeText(window.location.href); setFeito(true); } catch { /* copia à mão */ }
    }}>{feito ? 'Link copiado ✓' : 'Copiar link'}</Botao>
  );
}

function Passos({ plataforma, podeInstalar, instalar }: { plataforma: Plataforma; podeInstalar: boolean; instalar: () => Promise<boolean> }) {
  // Android e computador com Chrome/Edge: o próprio browser instala num toque
  if (podeInstalar)
    return (
      <div className="flex flex-col items-start gap-3">
        <h2 className="text-lg font-semibold">Instalar num toque</h2>
        <p className="text-sm text-tinta/70">Toque no botão e confirme. A app fica no ecrã principal, como as outras.</p>
        <Botao onClick={instalar} className="w-full sm:w-auto">Instalar a app</Botao>
        {plataforma === 'computador' && (
          <div className="mt-3 flex w-full flex-col items-center gap-2 border-t border-linha pt-4 text-center">
            <p className="text-sm text-tinta/70">Ou, para o telemóvel, aponte a câmara a este código:</p>
            <CodigoQR texto={window.location.href} tamanho={160} />
          </div>
        )}
      </div>
    );

  switch (plataforma) {
    case 'iphone_safari':
      return (
        <Lista titulo="Instalar no iPhone">
          <Passo n={1}>Toque em <strong>Partilhar</strong> (o quadrado com a seta para cima, na barra do Safari; nas versões mais recentes está no menu <strong>⋯</strong>).</Passo>
          <Passo n={2}>Deslize e escolha <strong>Adicionar ao ecrã principal</strong>.</Passo>
          <Passo n={3}>Toque em <strong>Adicionar</strong>.</Passo>
          {PasseAbrir}
        </Lista>
      );
    case 'iphone_outro':
      return (
        <div className="flex flex-col gap-4">
          <Lista titulo="Instalar no iPhone">
            <Passo n={1}>Toque em <strong>Partilhar</strong> (no Chrome, fica na barra do endereço; no Firefox e no Edge, no menu).</Passo>
            <Passo n={2}>Escolha <strong>Adicionar ao ecrã principal</strong>.</Passo>
            <Passo n={3}>Toque em <strong>Adicionar</strong>.</Passo>
            {PasseAbrir}
          </Lista>
          <p className="text-sm text-tinta/60">Não aparece a opção? Copie o link e abra-o no <strong>Safari</strong>.</p>
          <div><CopiarLink /></div>
        </div>
      );
    case 'app_interna_iphone':
      return (
        <div className="flex flex-col items-start gap-3">
          <h2 className="text-lg font-semibold">Abra no Safari primeiro</h2>
          <p className="text-sm text-tinta/70">
            Está a ver dentro de outra app (Facebook, Instagram…), que não deixa instalar. Toque no menu <strong>⋯</strong> ou no ícone da
            bússola e escolha <strong>Abrir no Safari</strong>. Depois siga os passos que aparecem.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={`x-safari-${window.location.href}`}
              className="inline-flex min-h-10 items-center rounded-lg bg-relva px-4 py-2 text-sm font-semibold text-white hover:bg-relva-escura">
              Abrir no Safari
            </a>
            <CopiarLink />
          </div>
        </div>
      );
    case 'app_interna_android':
      return (
        <div className="flex flex-col items-start gap-3">
          <h2 className="text-lg font-semibold">Abra no Chrome primeiro</h2>
          <p className="text-sm text-tinta/70">
            Está a ver dentro de outra app (Facebook, Instagram…), que não deixa instalar. Abra no Chrome e siga os passos que aparecem.
          </p>
          <a href={abrirNoChrome(window.location.href)}
            className="inline-flex min-h-10 items-center rounded-lg bg-relva px-4 py-2 text-sm font-semibold text-white hover:bg-relva-escura">
            Abrir no Chrome
          </a>
        </div>
      );
    case 'android_samsung':
      return (
        <Lista titulo="Instalar no Android">
          <Passo n={1}>Toque no menu <strong>☰</strong> (em baixo, à direita).</Passo>
          <Passo n={2}>Escolha <strong>Adicionar página a</strong> e depois <strong>Ecrã principal</strong>.</Passo>
          <Passo n={3}>Confirme em <strong>Adicionar</strong>.</Passo>
          {PasseAbrir}
        </Lista>
      );
    case 'android':
      return (
        <Lista titulo="Instalar no Android">
          <Passo n={1}>Toque no menu <strong>⋮</strong> (em cima, à direita).</Passo>
          <Passo n={2}>Escolha <strong>Instalar app</strong> ou <strong>Adicionar ao ecrã principal</strong>.</Passo>
          <Passo n={3}>Confirme em <strong>Instalar</strong>.</Passo>
          {PasseAbrir}
        </Lista>
      );
    default:
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-lg font-semibold">Abra no telemóvel</h2>
          <p className="text-sm text-tinta/70">Aponte a câmara do telemóvel a este código e siga os passos que aparecem.</p>
          <CodigoQR texto={window.location.href} tamanho={180} />
          <p className="text-xs text-tinta/55">No computador, o Chrome e o Edge também instalam: procure o ícone de instalar na barra do endereço.</p>
        </div>
      );
  }
}
