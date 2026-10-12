// Generator registry. Adding a style = one new file in ./generators + one line here.
import type { Generator, GeneratorCategory } from './types.ts';

const registry = new Map<string, Generator>();

export function registerGenerator(gen: Generator): void {
  if (registry.has(gen.id)) throw new Error(`duplicate generator id: ${gen.id}`);
  registry.set(gen.id, gen);
}

/** Category for grouping in the style dropdown (new gens declare it; legacy 2D mapped here). */
export function generatorCategory(gen: Generator): GeneratorCategory {
  if (gen.category) return gen.category;
  switch (gen.id) {
    case 'god-rays':
    case 'particles':
    case 'raymarched':
      return 'Light';
    case 'voronoi':
    case 'kaleidoscope':
    case 'truchet':
    case 'topographic':
    case 'julia':
    case 'halftone':
      return 'Geometric';
    default:
      return 'Organic';
  }
}

export function getGenerator(id: string): Generator | undefined {
  return registry.get(id);
}

export function listGenerators(): Generator[] {
  return [...registry.values()];
}

export function clearRegistry(): void {
  registry.clear();
}
