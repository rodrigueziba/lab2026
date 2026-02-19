import { Test, TestingModule } from '@nestjs/testing';
import { PostulacionService } from './postulacion.service';

describe('PostulacionService', () => {
  let service: PostulacionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostulacionService],
    }).compile();

    service = module.get<PostulacionService>(PostulacionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
