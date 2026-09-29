import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'perigo';

const estilosBotao: Record<Variante, string> = {
  primario: 'bg-relva text-white hover:bg-relva-escura',
  secundario: 'border border-linha bg-white text-tinta hover:bg-giz',
  perigo: 'text-vermelho hover:bg-vermelho/10',
};

export function Botao({ variante = 'primario', className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-relva ${estilosBotao[variante]} ${className}`}
      {...props}
    />
  );
}

export function Campo({ rotulo, ajuda, children, className = '' }:
  { rotulo: string; ajuda?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-medium">{rotulo}</span>
      {children}
      {ajuda && <span className="text-xs text-tinta/60">{ajuda}</span>}
    </label>
  );
}

const clsCampo =
  'rounded-md border border-linha bg-white px-3 py-2 text-sm text-tinta focus:border-relva focus:outline-none focus:ring-2 focus:ring-relva/20';

export function Entrada({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${clsCampo} ${className}`} {...props} />;
}

export function Seletor({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${clsCampo} ${className}`} {...props} />;
}

export function Seccao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-linha bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold leading-none">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function Emblema({ url, nome, tamanho = 28 }: { url?: string | null; nome: string; tamanho?: number }) {
  const estilo = { width: tamanho, height: tamanho };
  if (url) return <img src={url} alt="" style={estilo} className="shrink-0 rounded-full bg-white object-cover" />;
  const iniciais = nome.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span aria-hidden style={estilo}
      className="grid shrink-0 place-items-center rounded-full bg-relva/10 font-display text-xs font-semibold text-relva">
      {iniciais}
    </span>
  );
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'info'; children: ReactNode }) {
  const cls = tipo === 'erro' ? 'border-vermelho/30 bg-vermelho/5 text-vermelho' : 'border-cartao/60 bg-cartao/15 text-tinta';
  return <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Carregando() {
  return <p className="py-8 text-center text-sm text-tinta/60">A carregar…</p>;
}
