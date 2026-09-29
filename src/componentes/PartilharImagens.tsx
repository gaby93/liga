import { useEffect, useMemo, useState } from 'react';
import {
  TIPO_CARTAZ_LABEL, blocoPorDefeito, blocosParaCartaz, enderecoPublico, gerarCartaz, textoPartilha, type TipoCartaz,
} from '../lib/partilha';
import type { DadosCompeticao } from '../lib/useDadosCompeticao';
import { Aviso, Botao, Campo, Seccao, Seletor } from './ui';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Gera imagens de resultados ou de próximos jogos, prontas a enviar no WhatsApp. */
export function PartilharImagens({ d }: { d: DadosCompeticao }) {
  const c = d.competicao!;
  const [tipo, setTipo] = useState<TipoCartaz>('resultados');
  const [escolha, setEscolha] = useState<string>();
  const [imagem, setImagem] = useState<{ blob: Blob; url: string } | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'info'; texto: string } | null>(null);

  const blocos = useMemo(() => blocosParaCartaz(d.jogos, tipo), [d.jogos, tipo]);
  const titulo = escolha && blocos.some((b) => b.titulo === escolha) ? escolha : blocoPorDefeito(blocos, tipo);
  const bloco = blocos.find((b) => b.titulo === titulo);
  const endereco = enderecoPublico(c.id);
  // Muda quando muda algo que aparece na imagem (resultados em tempo real incluídos)
  const equipasNaImagem = [...new Set(bloco?.jogos.flatMap((j) => [j.casa_id, j.fora_id]))]
    .map((id) => [d.equipas.get(id)?.nome, d.equipas.get(id)?.emblema_url]);
  const assinatura = JSON.stringify([tipo, titulo, bloco?.jogos, c.nome, c.epoca, endereco, equipasNaImagem]);

  useEffect(() => {
    if (!bloco) { setImagem(null); return; }
    let cancelado = false;
    setAGerar(true);
    gerarCartaz({ tipo, competicao: c.nome, epoca: c.epoca, titulo: bloco.titulo, jogos: bloco.jogos, equipas: d.equipas, endereco })
      .then((blob) => {
        if (cancelado) return;
        setImagem((anterior) => {
          if (anterior) URL.revokeObjectURL(anterior.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
      })
      .catch((e) => !cancelado && setMensagem({ tipo: 'erro', texto: `Não foi possível criar a imagem: ${e.message ?? e}` }))
      .finally(() => !cancelado && setAGerar(false));
    return () => { cancelado = true; };
  }, [assinatura]);

  const nomeFicheiro = `${slug(c.nome)}-${slug(titulo ?? '')}-${tipo}.png`;
  const texto = bloco ? textoPartilha({ tipo, competicao: c.nome, titulo: bloco.titulo, jogos: bloco.jogos, equipas: d.equipas, endereco }) : '';
  const ficheiro = imagem && new File([imagem.blob], nomeFicheiro, { type: 'image/png' });
  const podePartilhar = Boolean(ficheiro && navigator.canShare?.({ files: [ficheiro] }));
  const podeCopiarImagem = typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write);

  const avisar = (t: string) => {
    setMensagem({ tipo: 'info', texto: t });
    setTimeout(() => setMensagem(null), 3000);
  };
  const falhar = (e: unknown) => {
    if ((e as Error)?.name === 'AbortError') return; // a pessoa fechou a janela de partilha
    setMensagem({ tipo: 'erro', texto: (e as Error)?.message ?? String(e) });
  };

  const partilhar = () => navigator.share({ files: [ficheiro!], text: texto }).catch(falhar);
  const copiarImagem = () => navigator.clipboard.write([new ClipboardItem({ 'image/png': imagem!.blob })])
    .then(() => avisar('Imagem copiada. Cole-a no WhatsApp Web com Ctrl+V.')).catch(falhar);
  const copiarTexto = () => navigator.clipboard.writeText(texto).then(() => avisar('Texto copiado.')).catch(falhar);
  const descarregar = () => {
    const a = document.createElement('a');
    a.href = imagem!.url;
    a.download = nomeFicheiro;
    a.click();
  };

  return (
    <Seccao titulo="Imagens para partilhar">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex rounded-md border border-linha p-0.5" role="radiogroup" aria-label="Tipo de imagem">
          {(Object.keys(TIPO_CARTAZ_LABEL) as TipoCartaz[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t}
              onClick={() => { setTipo(t); setEscolha(undefined); }}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${tipo === t ? 'bg-relva text-white' : 'hover:bg-giz'}`}>
              {TIPO_CARTAZ_LABEL[t]}
            </button>
          ))}
        </div>
        {blocos.length > 0 && (
          <Campo rotulo={tipo === 'resultados' ? 'Jornada ou ronda' : 'Jogos da'}>
            <Seletor value={titulo} onChange={(e) => setEscolha(e.target.value)}>
              {blocos.map((b) => <option key={b.titulo} value={b.titulo}>{b.titulo}</option>)}
            </Seletor>
          </Campo>
        )}
      </div>

      {!bloco ? (
        <p className="text-sm text-tinta/70">
          {tipo === 'resultados' ? 'Ainda não há resultados para mostrar.' : 'Não há jogos por fazer.'}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="relative">
            {imagem && (
              <img src={imagem.url} alt={`${bloco.titulo}: ${TIPO_CARTAZ_LABEL[tipo].toLowerCase()}`}
                className={`w-full rounded-md border border-linha ${aGerar ? 'opacity-50' : ''}`} />
            )}
            {aGerar && !imagem && <p className="py-16 text-center text-sm text-tinta/60">A criar a imagem…</p>}
          </div>
          <div className="flex flex-col items-start gap-2">
            {podePartilhar && <Botao disabled={!imagem} onClick={partilhar}>Partilhar (WhatsApp…)</Botao>}
            {podeCopiarImagem && (
              <Botao variante={podePartilhar ? 'secundario' : 'primario'} disabled={!imagem} onClick={copiarImagem}>Copiar imagem</Botao>
            )}
            <Botao variante="secundario" disabled={!imagem} onClick={descarregar}>Descarregar PNG</Botao>
            <Botao variante="secundario" onClick={copiarTexto}>Copiar texto</Botao>
            {mensagem && <div className="mt-2 w-full"><Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso></div>}
            {!endereco && (
              <p className="mt-2 text-xs text-tinta/60">
                O endereço do portal não aparece na imagem porque está a usar o computador local. Defina
                VITE_SITE_URL (ex.: https://liga.pages.dev) para o incluir.
              </p>
            )}
          </div>
        </div>
      )}
    </Seccao>
  );
}
