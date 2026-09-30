import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'perigo';

const estilosBotao: Record<Variante, string> = {
  primario: 'bg-relva text-white shadow-cartao hover:bg-relva-escura',
  secundario: 'border border-linha bg-white text-tinta shadow-cartao hover:bg-giz',
  perigo: 'text-vermelho hover:bg-vermelho/5',
};

export function Botao({ variante = 'primario', className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-relva ${estilosBotao[variante]} ${className}`}
      {...props}
    />
  );
}

export function Campo({ rotulo, ajuda, children, className = '' }:
  { rotulo: string; ajuda?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-tinta/80">{rotulo}</span>
      {children}
      {ajuda && <span className="text-xs text-tinta/55">{ajuda}</span>}
    </label>
  );
}

const clsCampo =
  'min-h-10 rounded-lg border border-linha bg-white px-3 py-2 text-sm text-tinta shadow-cartao transition-colors placeholder:text-tinta/40 focus:border-relva focus:outline-none focus:ring-3 focus:ring-relva/15 disabled:bg-giz disabled:text-tinta/50';

export function Entrada({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${clsCampo} ${className}`} {...props} />;
}

export function Seletor({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${clsCampo} ${className}`} {...props} />;
}

/** Cartão branco com título: o bloco base das páginas. */
export function Seccao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-linha bg-white p-4 shadow-cartao sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Pequena etiqueta de secção em maiúsculas (ex.: "Jornada 3", "Em curso"). */
export function Etiqueta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-xs font-semibold uppercase tracking-wider text-relva ${className}`}>{children}</h2>;
}

export function Emblema({ url, nome, tamanho = 28 }: { url?: string | null; nome: string; tamanho?: number }) {
  const estilo = { width: tamanho, height: tamanho };
  if (url) return <img src={url} alt="" style={estilo} className="shrink-0 rounded-full bg-white object-cover ring-1 ring-linha" />;
  const iniciais = nome.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span aria-hidden style={{ ...estilo, fontSize: Math.max(10, tamanho * 0.38) }}
      className="grid shrink-0 place-items-center rounded-full bg-giz font-semibold text-tinta/60 ring-1 ring-linha">
      {iniciais}
    </span>
  );
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'info'; children: ReactNode }) {
  const cls = tipo === 'erro'
    ? 'border-vermelho/20 bg-vermelho/5 text-vermelho'
    : 'border-relva/15 bg-relva/5 text-tinta';
  return <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-lg border px-3.5 py-2.5 text-sm ${cls}`}>{children}</div>;
}

export function Carregando() {
  return (
    <p className="flex items-center justify-center gap-2 py-10 text-sm text-tinta/50">
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-linha border-t-relva" />
      A carregar…
    </p>
  );
}

/** Marca da app: ícone + nome. `clara` para usar sobre a faixa verde. */
export function Marca({ texto = 'Bola do Bairro', clara = false }: { texto?: string; clara?: boolean }) {
  return (
    <span className={`flex items-center gap-2 font-semibold tracking-tight ${clara ? 'text-white' : ''}`}>
      <img src="/icone.svg" alt="" className={`h-7 w-7 rounded-lg ${clara ? 'ring-1 ring-white/35' : ''}`} />
      {texto}
    </span>
  );
}
