import { supabase } from './supabase';

/** Redimensiona a imagem no browser antes do upload (poupa espaço no plano gratuito). */
export async function comprimirImagem(ficheiro: File, maximo = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(ficheiro);
  const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolver, rejeitar) =>
    canvas.toBlob(
      (b) => (b ? resolver(b) : rejeitar(new Error('Não foi possível converter a imagem.'))),
      'image/webp',
      0.82,
    ),
  );
}

export async function carregarImagem(ficheiro: File, pasta: 'emblemas' | 'jogadores'): Promise<string> {
  const blob = await comprimirImagem(ficheiro);
  const caminho = `${pasta}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from('media').upload(caminho, blob, { contentType: 'image/webp' });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(caminho).data.publicUrl;
}
