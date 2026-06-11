import { redirect } from 'next/navigation';

export default async function OrdemServicoDetalheRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/chamados?id=${encodeURIComponent(id)}`);
}
