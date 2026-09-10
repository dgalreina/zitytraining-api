import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Holiday, HolidayOrigin } from './holidays.schema';
import { CreateHolidayDto } from './dto/create-holiday.dto';

// Solo esta comunidad: el gimnasio está en Valladolid.
const SUBDIVISION_CODE = 'ES-CL';

interface OpenHolidaysEntry {
  startDate: string;
  name: { language: string; text: string }[];
  nationwide: boolean;
  subdivisions?: { code: string }[];
}

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(@InjectModel(Holiday.name) private holidayModel: Model<Holiday>) {}

  async findByYear(year: number): Promise<Holiday[]> {
    await this.ensureYearSynced(year);
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    return this.holidayModel
      .find({ date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .exec();
  }

  async create(data: CreateHolidayDto): Promise<Holiday> {
    const created = new this.holidayModel({
      date: new Date(`${data.date}T00:00:00.000Z`),
      name: data.name,
      origin: HolidayOrigin.MANUAL,
    });
    return created.save();
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.holidayModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Holiday with id ${id} not found`);
    }
  }

  // Botón "Actualizar" de la página de gestión: fuerza a volver a pedir
  // ese año a la API (por si hubo un fallo de red la primera vez, o la
  // propia API corrige algo más adelante).
  async resyncYear(year: number): Promise<Holiday[]> {
    await this.syncFromApi(year);
    return this.findByYear(year);
  }

  // Se llama de pasada al listar (igual que resolveExpiredPunctualPlans en
  // purchases): si ese año no tiene todavía ningún festivo traído de la
  // API, se piden ahora. No hay tarea programada aparte.
  private async ensureYearSynced(year: number): Promise<void> {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    const alreadySynced = await this.holidayModel.countDocuments({
      date: { $gte: start, $lte: end },
      origin: HolidayOrigin.API,
    });
    if (alreadySynced > 0) return;
    await this.syncFromApi(year);
  }

  // Trae de OpenHolidays API los festivos nacionales y los de Castilla y
  // León para ese año. Si la API externa falla, no se rompe nada: ese año
  // sencillamente se queda sin festivos automáticos hasta el próximo
  // intento (siguiente vez que se pida, o pulsando "Actualizar").
  private async syncFromApi(year: number): Promise<void> {
    const url = `https://openholidaysapi.org/PublicHolidays?countryIsoCode=ES&languageIsoCode=ES&validFrom=${year}-01-01&validTo=${year}-12-31`;
    let data: OpenHolidaysEntry[];
    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`OpenHolidays API respondió ${res.status} para el año ${year}`);
        return;
      }
      data = await res.json();
    } catch (err) {
      this.logger.warn(`No se pudo contactar con OpenHolidays API: ${err}`);
      return;
    }

    const relevant = data.filter(
      (h) => h.nationwide || (h.subdivisions || []).some((s) => s.code === SUBDIVISION_CODE),
    );

    for (const h of relevant) {
      const name = h.name.find((n) => n.language === 'ES')?.text || h.name[0]?.text || 'Festivo';
      const date = new Date(`${h.startDate}T00:00:00.000Z`);
      await this.holidayModel.updateOne(
        { date, origin: HolidayOrigin.API },
        { $setOnInsert: { date, name, origin: HolidayOrigin.API } },
        { upsert: true },
      );
    }
  }
}
