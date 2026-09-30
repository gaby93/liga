import { useEffect, useState } from 'react';
import { linkConvite, textoConvite } from '../lib/instalar';
import { Botao } from './ui';

const base = () => ((import.meta.env.VITE_SITE_URL as string | undefined) || window.location.origin).replace(/\/$/, '');

function IconePartilhar({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

/** QR code do link (a biblioteca só se carrega quando é preciso). */
export function CodigoQR({ texto, tamanho = 200 }: { texto: string; tamanho?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    import('qrcode')
      .then((q) => q.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#17202c', light: '#ffffff' } }))
      .then((s) => { if (!cancelado) setSvg(s); })
      .catch(() => undefined);
    return () => { cancelado = true; };
  }, [texto]);
  return (
    <div role="img" aria-label="QR code do convite" style={{ width: tamanho, height: tamanho }}
      className="grid place-items-center overflow-hidden rounded-xl border border-linha bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}>
      {svg ? undefined : <span className="text-xs text-tinta/40">A gerar…</span>}
    </div>
  );
}

/** Formas de passar o convite: partilhar, WhatsApp, copiar e QR code para mostrar no campo. */
export function PainelConvite({ competicaoId, nome }: { competicaoId?: string; nome?: string }) {
  const link = linkConvite(base(), competicaoId);
  const texto = textoConvite(link, nome);
  const [copiado, setCopiado] = useState(false);
  const podePartilhar = typeof navigator !== 'undefined' && 'share' in navigator;

  const partilhar = async () => {
    try { await navigator.share({ title: nome ?? 'Liga recreativa', text: texto }); } catch { /* cancelado */ }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* sem acesso à área de transferência: o link está visível para copiar à mão */ }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <CodigoQR texto={link} />
      <p className="text-center text-sm text-tinta/65">
        Mostre este código no campo: quem o ler com a câmara do telemóvel vê como instalar a app.
      </p>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {podePartilhar && <Botao onClick={partilhar} className="sm:col-span-2"><IconePartilhar className="h-4 w-4" />Partilhar convite</Botao>}
        <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-cartao hover:brightness-95"
          style={{ background: '#25D366' }}>
          Enviar no WhatsApp
        </a>
        <Botao variante="secundario" onClick={copiar}>{copiado ? 'Link copiado ✓' : 'Copiar link'}</Botao>
      </div>
      <p className="w-full break-all text-center text-xs text-tinta/50">{link}</p>
    </div>
  );
}

/** Botão (ícone na faixa verde, ou botão normal) que abre o convite numa janela. */
export function BotaoConvidar({ competicaoId, nome, clara = false }: { competicaoId?: string; nome?: string; clara?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {clara ? (
        <button type="button" onClick={() => setAberto(true)} aria-label="Convidar para a app" title="Convidar para a app"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white">
          <IconePartilhar className="h-5 w-5" />
        </button>
      ) : (
        <Botao variante="secundario" onClick={() => setAberto(true)}><IconePartilhar className="h-4 w-4" />Convidar</Botao>
      )}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 sm:items-center sm:p-4" onClick={() => setAberto(false)}>
          <div role="dialog" aria-label="Convidar para a app" onClick={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 text-tinta shadow-xl sm:rounded-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Convidar para a app</h2>
                <p className="text-sm text-tinta/60">{nome ? `Quem abrir o convite fica a seguir a ${nome}.` : 'Resultados, tabelas e avisos de golos no telemóvel.'}</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar"
                className="rounded-lg px-2 py-1 text-tinta/50 hover:bg-giz hover:text-tinta">✕</button>
            </div>
            <PainelConvite competicaoId={competicaoId} nome={nome} />
          </div>
        </div>
      )}
    </>
  );
}
