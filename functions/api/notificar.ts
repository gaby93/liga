// POST /api/notificar (Cloudflare Pages Functions). A lógica e os testes estão em src/servidor/notificar.ts:
// aqui não pode haver outros ficheiros, porque cada ficheiro desta pasta vira um endereço do site.
import { tratar, type Env } from '../../src/servidor/notificar';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => tratar(request, env);
