import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Exercise, ExerciseCategory } from './exercises.schema';

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SEARCH_STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'con']);

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

// Una palabra de la busqueda "encaja" en una palabra del nombre si es
// substring suya, o (a partir de 4 letras, para no disparar falsos
// positivos con palabras cortas) si solo se diferencian en una letra.
function wordMatches(queryWord: string, nameWord: string): boolean {
  if (nameWord.includes(queryWord)) return true;
  if (queryWord.length < 4) return false;
  return levenshtein(queryWord, nameWord) <= 1;
}

@Injectable()
export class ExercisesService {
  constructor(@InjectModel(Exercise.name) private exerciseModel: Model<Exercise>) {}

  // Busqueda por palabras sueltas (no importa el orden ni si falta un "de")
  // y tolerante a una errata por palabra. El catalogo es pequeño (base +
  // lo que añade cada entrenador), así que se trae entero y se puntua en
  // memoria en vez de depender de un regex de substring exacto.
  async search(query: string): Promise<Exercise[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const queryWords = normalizeForSearch(trimmed)
      .split(/\s+/)
      .filter((w) => w.length > 0 && !SEARCH_STOPWORDS.has(w));
    if (queryWords.length === 0) return [];

    const all = await this.exerciseModel.find().sort({ name: 1 }).exec();
    const matches = all.filter((ex) => {
      const nameWords = normalizeForSearch(ex.name).split(/\s+/);
      return queryWords.every((qw) => nameWords.some((nw) => wordMatches(qw, nw)));
    });

    return matches.slice(0, 10);
  }

  // Si ya existe uno con el mismo nombre (sin distinguir mayusculas) se
  // reutiliza en vez de crear un duplicado. Sin categoria (ej. creado al
  // vuelo desde un entrenamiento) cae en OTROS, reclasificable despues.
  async findOrCreate(name: string, category?: ExerciseCategory): Promise<Exercise> {
    const trimmed = name.trim();
    const existing = await this.exerciseModel.findOne({
      name: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' },
    });
    if (existing) return existing;

    const created = new this.exerciseModel({ name: trimmed, category });
    return created.save();
  }

  // Para la pestaña de gestion: el catalogo completo, no solo lo que
  // matchea una busqueda.
  async findAll(): Promise<Exercise[]> {
    return this.exerciseModel.find().sort({ name: 1 }).exec();
  }

  async update(id: string, name: string, category?: ExerciseCategory): Promise<Exercise> {
    const existing = await this.exerciseModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Exercise with id ${id} not found`);
    }
    if (existing.locked) {
      throw new ForbiddenException('Este ejercicio es del catálogo base y no se puede editar');
    }
    existing.name = name.trim();
    if (category) existing.category = category;
    return existing.save();
  }

  // Borrado normal: si algun entrenamiento ya usaba este ejercicio, ese
  // slot se queda sin referencia valida (se muestra como "eliminado" en
  // el frontend), igual que pasa con los planes borrados del catalogo.
  async remove(id: string): Promise<void> {
    const existing = await this.exerciseModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Exercise with id ${id} not found`);
    }
    if (existing.locked) {
      throw new ForbiddenException('Este ejercicio es del catálogo base y no se puede eliminar');
    }
    await existing.deleteOne();
  }
}
