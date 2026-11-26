import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner } from '@nestjs/core';
import { GraphInspector } from '@nestjs/core/inspector/graph-inspector';
import { NestContainer } from '@nestjs/core/injector/container';
import { DependenciesScanner } from '@nestjs/core/scanner';

export type HttpMetodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RotaDescoberta = {
  chave: string;
  metodo: HttpMetodo;
  caminho: string;
  controller: Type<unknown>;
  handlerNome: string;
  handler: (...args: unknown[]) => unknown;
};

const METODOS: Partial<Record<RequestMethod, HttpMetodo>> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

function juntarCaminho(...partes: Array<string | string[] | undefined>) {
  const segs = partes
    .map((p) => (Array.isArray(p) ? p[0] : p) ?? '')
    .flatMap((p) => p.split('/'))
    .filter(Boolean);
  return `/${segs.join('/')}`;
}

/** Chave canônica da rota na matriz: `MÉTODO /caminho/:param`. */
export function chaveRota(metodo: HttpMetodo, controllerPath: string | string[] | undefined, handlerPath: string | string[] | undefined) {
  return `${metodo} ${juntarCaminho(controllerPath, handlerPath)}`;
}

/** Chave da rota a partir do controller/handler (metadados do Nest). */
export function chaveRotaPorHandler(controller: Type<unknown>, handler: (...args: unknown[]) => unknown): string | null {
  const metodo = METODOS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
  if (!metodo) return null;
  return chaveRota(metodo, Reflect.getMetadata(PATH_METADATA, controller), Reflect.getMetadata(PATH_METADATA, handler));
}

export function rotasDoController(controller: Type<unknown>): RotaDescoberta[] {
  const proto = controller.prototype as Record<string, unknown>;
  const scanner = new MetadataScanner();
  const out: RotaDescoberta[] = [];
  for (const nome of scanner.getAllMethodNames(proto)) {
    const handler = proto[nome] as (...args: unknown[]) => unknown;
    if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
    const chave = chaveRotaPorHandler(controller, handler);
    if (!chave) continue;
    const [metodo, caminho] = chave.split(' ') as [HttpMetodo, string];
    out.push({ chave, metodo, caminho, controller, handlerNome: nome, handler });
  }
  return out;
}

/**
 * Descobre todas as rotas registradas a partir do módulo raiz usando o scanner de
 * dependências do Nest (metadados @Module/@Controller), sem instanciar providers nem banco.
 */
export async function descobrirRotas(moduloRaiz: Type<unknown>): Promise<RotaDescoberta[]> {
  const container = new NestContainer();
  const scanner = new DependenciesScanner(container, new MetadataScanner(), new GraphInspector(container));
  await scanner.scan(moduloRaiz);
  const controllers = new Set<Type<unknown>>();
  for (const mod of container.getModules().values()) {
    for (const wrapper of mod.controllers.values()) {
      if (wrapper.metatype) controllers.add(wrapper.metatype as Type<unknown>);
    }
  }
  return [...controllers].flatMap(rotasDoController).sort((a, b) => a.chave.localeCompare(b.chave));
}
