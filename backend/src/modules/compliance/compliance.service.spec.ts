import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from './compliance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { BadRequestException } from '@nestjs/common';

describe('ComplianceService', () => {
  let service: ComplianceService;
  let prismaService: jest.Mocked<PrismaService>;
  let loggerService: jest.Mocked<LoggerService>;

  const mockContent = {
    id: 'content-1',
    workspaceId: 'ws-1',
    title: 'Test',
    body: 'This is test content without prohibited words',
    summary: '',
  };

  const mockScan = {
    id: 'scan-1',
    contentId: 'content-1',
    workspaceId: 'ws-1',
    scanType: 'sensitive' as const,
    triggeredBy: 'user-1',
    status: 'pending' as const,
    createdAt: new Date(),
    completedAt: null,
    overallRisk: null,
    violations: [],
    errorMessage: null,
    userOverride: false,
    overrideReason: null,
    overrideBy: null,
    overrideAt: null,
  };

  beforeEach(async () => {
    prismaService = {
      content: { findFirst: jest.fn() },
      complianceScan: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      workspaceMember: { findFirst: jest.fn() },
    } as any;

    loggerService = {
      log: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LoggerService, useValue: loggerService },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scanContent', () => {
    it('should create a compliance scan', async () => {
      prismaService.content.findFirst.mockResolvedValue(mockContent);
      prismaService.complianceScan.create.mockResolvedValue(mockScan);

      const result = await service.scanContent('ws-1', 'user-1', 'content-1', 'sensitive');

      expect(result).toMatchObject({
        contentId: 'content-1',
        scanType: 'sensitive',
        status: 'pending',
      });
    });

    it('should throw BadRequestException if content not found', async () => {
      prismaService.content.findFirst.mockResolvedValue(null);

      await expect(service.scanContent('ws-1', 'user-1', 'content-1', 'sensitive')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getScanResults', () => {
    it('should return list of scans for content', async () => {
      const scans = [mockScan];
      prismaService.complianceScan.findMany.mockResolvedValue(scans);

      const result = await service.getScanResults('ws-1', 'content-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('getScanById', () => {
    it('should return scan by id', async () => {
      prismaService.complianceScan.findFirst.mockResolvedValue(mockScan);

      const result = await service.getScanById('ws-1', 'scan-1', 'user-1');

      expect(result.id).toBe('scan-1');
    });

    it('should throw BadRequestException if scan not found', async () => {
      prismaService.complianceScan.findFirst.mockResolvedValue(null);

      await expect(service.getScanById('ws-1', 'scan-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('overrideScan', () => {
    it('should allow creator/admin to override scan', async () => {
      const completedScan = { ...mockScan, status: 'completed' as const };
      prismaService.complianceScan.findFirst.mockResolvedValue(completedScan);
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'creator' });
      prismaService.complianceScan.update.mockResolvedValue({ ...completedScan, userOverride: true });

      const result = await service.overrideScan('ws-1', 'scan-1', 'user-1', 'False positive');

      expect(result.userOverride).toBe(true);
      expect(result.overrideReason).toBe('False positive');
    });

    it('should throw if scan not found', async () => {
      prismaService.complianceScan.findFirst.mockResolvedValue(null);

      await expect(service.overrideScan('ws-1', 'scan-1', 'user-1', 'reason')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if scan not completed', async () => {
      prismaService.complianceScan.findFirst.mockResolvedValue(mockScan); // pending

      await expect(service.overrideScan('ws-1', 'scan-1', 'user-1', 'reason')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if user lacks permission', async () => {
      const completedScan = { ...mockScan, status: 'completed' as const };
      prismaService.complianceScan.findFirst.mockResolvedValue(completedScan);
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });

      await expect(service.overrideScan('ws-1', 'scan-1', 'user-1', 'reason')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('performScan (private)', () => {
    // We can test this indirectly through scanContent, but we can also try to access the private method via type casting
    it('should detect medium risk for sensitive words', async () => {
      const riskyContent = { body: 'This content contains spam and hack techniques', summary: '' };
      const risk = await (service as any).performScan(riskyContent, 'sensitive');
      expect(risk).toBeOneOf(['medium', 'high', 'critical']);
    });

    it('should return low risk for clean content', async () => {
      const cleanContent = { body: 'Hello world', summary: '' };
      const risk = await (service as any).performScan(cleanContent, 'sensitive');
      expect(risk).toBe('low');
    });
  });
});
