import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Cria uma resposta base que podemos modificar se necessário
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Instancia o cliente Supabase SSR para ler e gravar os cookies da sessão
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Puxa o usuário atual validando o token de forma segura no servidor
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Regra 1: Se tentar acessar o /dashboard e não estiver logado, chuta para o /login
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Regra 2: Se já estiver logado e tentar acessar a tela de /login, manda para o /dashboard
  if (request.nextUrl.pathname.startsWith('/login') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

// O Matcher (filtro) define em quais rotas esse Middleware vai rodar
// Aqui excluímos arquivos estáticos (imagens, CSS) para economizar processamento e dinheiro
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};