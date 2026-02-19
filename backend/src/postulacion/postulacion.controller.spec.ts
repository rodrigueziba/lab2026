import { Test, TestingModule } from '@nestjs/testing';
import { PostulacionController } from './postulacion.controller';
import { PostulacionService } from './postulacion.service';

describe('PostulacionController', () => {
  let controller: PostulacionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostulacionController],
      providers: [PostulacionService],
    }).compile();

    controller = module.get<PostulacionController>(PostulacionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
