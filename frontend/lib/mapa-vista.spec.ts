import { describe, expect, it } from 'vitest';
import { devePreservarVistaNoLayout } from './mapa-vista';

describe('BK-321-O1 — vista manual no reflow', () => {
  it('layout com zoom ou arraste manual preserva centro e zoom', () => {
    expect(
      devePreservarVistaNoLayout({ motivo: 'layout', vistaManual: true, zoomAtual: 14, zoomAoAgendar: 14 }),
    ).toBe(true);
  });

  it('layout sem gesto manual preserva se o zoom subiu durante a espera', () => {
    expect(
      devePreservarVistaNoLayout({ motivo: 'layout', vistaManual: false, zoomAtual: 15, zoomAoAgendar: 13 }),
    ).toBe(true);
    expect(
      devePreservarVistaNoLayout({ motivo: 'layout', vistaManual: false, zoomAtual: 13, zoomAoAgendar: 13 }),
    ).toBe(false);
  });

  it('troca de dados não usa esta trava (Aplicar continua em manterVista)', () => {
    expect(
      devePreservarVistaNoLayout({ motivo: 'data', vistaManual: true, zoomAtual: 16, zoomAoAgendar: 12 }),
    ).toBe(false);
  });
});
