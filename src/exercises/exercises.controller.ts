import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/users.schema';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  // Con "q": autocompletado del selector al crear un entrenamiento. Sin
  // "q": el catalogo completo, para la pestaña de gestion.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Get()
  findAll(@Query('q') q?: string) {
    if (q && q.trim().length > 0) return this.exercisesService.search(q);
    return this.exercisesService.findAll();
  }

  // Alta rapida desde el propio selector cuando no existe todavia (y
  // tambien la que usa la pestaña de gestion para crear uno nuevo).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Post()
  create(@Body() body: CreateExerciseDto) {
    return this.exercisesService.findOrCreate(body.name);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateExerciseDto) {
    return this.exercisesService.update(id, body.name!);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TRAINER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.exercisesService.remove(id);
  }
}
