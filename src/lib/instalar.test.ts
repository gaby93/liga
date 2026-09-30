import { describe, expect, it } from 'vitest';
import { abrirNoChrome, linkConvite, plataforma, textoConvite } from './instalar';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.108]',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidInstagram: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 337.0.0.0',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('plataforma', () => {
  it('reconhece cada aparelho e browser', () => {
    expect(plataforma(UA.iphoneSafari, { instalada: false })).toBe('iphone_safari');
    expect(plataforma(UA.iphoneChrome, { instalada: false })).toBe('iphone_outro');
    expect(plataforma(UA.iphoneFacebook, { instalada: false })).toBe('app_interna_iphone');
    expect(plataforma(UA.androidChrome, { instalada: false })).toBe('android');
    expect(plataforma(UA.androidSamsung, { instalada: false })).toBe('android_samsung');
    expect(plataforma(UA.androidInstagram, { instalada: false })).toBe('app_interna_android');
    expect(plataforma(UA.windows, { instalada: false })).toBe('computador');
  });

  it('o iPad diz ser um Mac, mas tem ecrã tátil', () => {
    expect(plataforma(UA.ipad, { instalada: false, toque: true })).toBe('iphone_safari');
    expect(plataforma(UA.ipad, { instalada: false, toque: false })).toBe('computador');
  });

  it('já instalada tem prioridade', () => {
    expect(plataforma(UA.iphoneSafari, { instalada: true })).toBe('instalada');
  });
});

describe('convite', () => {
  it('leva à página de instalação, com a competição', () => {
    expect(linkConvite('https://liga.exemplo/', 'abc')).toBe('https://liga.exemplo/instalar?c=abc');
    expect(linkConvite('https://liga.exemplo')).toBe('https://liga.exemplo/instalar');
  });

  it('texto com e sem competição termina no link', () => {
    expect(textoConvite('L', 'Liga Jardim')).toMatch(/^Acompanhe a Liga Jardim.*: L$/);
    expect(textoConvite('L')).toMatch(/: L$/);
  });

  it('abre no Chrome a partir de outra app no Android', () => {
    const u = abrirNoChrome('https://liga.exemplo/instalar?c=abc');
    expect(u).toMatch(/^intent:\/\/liga\.exemplo\/instalar\?c=abc#Intent;scheme=https;package=com\.android\.chrome;/);
    expect(u).toContain(`S.browser_fallback_url=${encodeURIComponent('https://liga.exemplo/instalar?c=abc')}`);
  });
});
