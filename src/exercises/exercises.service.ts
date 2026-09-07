import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Exercise, ExerciseCategory } from './exercises.schema';

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class ExercisesService {
  constructor(@InjectModel(Exercise.name) private exerciseModel: Model<Exercise>) {}

  // El frontend ya exige 3 letras minimo antes de llamar; aqui solo se
  // acota para no devolver listas enormes si llega una query muy corta.
  async search(query: string): Promise<Exercise[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    return this.exerciseModel
      .find({ name: { $regex: escapeRegex(trimmed), $options: 'i' } })
      .sort({ name: 1 })
      .limit(10)
      .exec();
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
