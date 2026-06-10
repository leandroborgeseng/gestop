import { redirect } from 'next/navigation';

export default function OrdemServicoDetalheRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/chamados?id=${encodeURIComponent(params.id)}`);
}
