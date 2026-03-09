import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockWorkspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    description: 'A test workspace',
    avatarUrl: null,
    ownerId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockWorkspaceMember = {
    workspaceId: 'ws-1',
    userId: 'user-1',
    role: 'creator',
    joinedAt: new Date(),
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      avatarUrl: null,
      createdAt: new Date(),
    },
  };

  beforeEach(async () => {
    prismaService = {
      workspace: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      workspaceMember: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a workspace with unique slug', async () => {
      const createDto = { name: 'My Workspace', description: 'desc' };
      prismaService.workspace.findFirst.mockResolvedValue(null); // slug not exists
      prismaService.$transaction.mockResolvedValue(mockWorkspace);

      const result = await (service as any).create({ ...createDto, ownerId: 'user-1' });

      expect(result).toMatchObject({
        id: mockWorkspace.id,
        name: mockWorkspace.name,
        slug: mockWorkspace.slug,
      });
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should generate unique slug if conflict exists', async () => {
      const createDto = { name: 'My Workspace', description: 'desc' };
      prismaService.workspace.findFirst
        .mockResolvedValueOnce({ slug: 'my-workspace' }) // first call to check slug
        .mockResolvedValueOnce(null); // second call inside createWithSlug (after adding suffix)
      prismaService.$transaction.mockResolvedValue(mockWorkspace);

      const result = await (service as any).create({ ...createDto, ownerId: 'user-1' });

      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return list of workspaces for user', async () => {
      const memberships = [{ workspace: mockWorkspace }];
      prismaService.workspaceMember.findMany.mockResolvedValue(memberships);

      const result = await service.findAll('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: mockWorkspace.id });
    });
  });

  describe('findOne', () => {
    it('should return workspace by id', async () => {
      const workspaceWithMembers = {
        ...mockWorkspace,
        members: [],
      };
      prismaService.workspace.findUnique.mockResolvedValue(workspaceWithMembers);

      const result = await service.findOne('ws-1');

      expect(result.id).toBe('ws-1');
    });

    it('should throw NotFoundException if workspace not found or deleted', async () => {
      prismaService.workspace.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      const workspaceWithMembers = { ...mockWorkspace, members: [] };
      prismaService.workspace.findUnique.mockResolvedValue(workspaceWithMembers);
      prismaService.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(service.findOne('ws-1', 'user-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update workspace successfully with proper permissions', async () => {
      const membership = { role: 'admin' };
      prismaService.workspaceMember.findFirst.mockResolvedValue(membership);
      prismaService.workspace.update.mockResolvedValue(mockWorkspace);

      const updateDto = { name: 'Updated Name' };
      const result = await service.update('ws-1', updateDto, 'user-1');

      expect(result.name).toBe('Updated Name');
    });

    it('should throw ForbiddenException if insufficient permissions', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });

      await expect(service.update('ws-1', { name: 'New' }, 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should check slug uniqueness when updating slug', async () => {
      const membership = { role: 'creator' };
      prismaService.workspaceMember.findFirst.mockResolvedValue(membership);
      prismaService.workspace.findFirst.mockResolvedValue({ id: 'other-ws' }); // slug taken

      await expect(service.update('ws-1', { slug: 'taken-slug' }, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete workspace if user is creator', async () => {
      const membership = { role: 'creator' };
      prismaService.workspaceMember.findFirst.mockResolvedValue(membership);
      prismaService.workspace.update.mockResolvedValue(mockWorkspace);

      await service.delete('ws-1', 'user-1');

      expect(prismaService.workspace.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException if not creator', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'admin' });

      await expect(service.delete('ws-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('inviteMember', () => {
    it('should add existing user as member', async () => {
      const investerMembership = { role: 'admin' };
      prismaService.workspaceMember.findFirst
        .mockResolvedValueOnce(investerMembership) // check invester perm
        .mockResolvedValueOnce(null); // check existing membership
      prismaService.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'new@example.com' });
      prismaService.workspaceMember.create.mockResolvedValue({} as any);

      const result = await service.inviteMember('ws-1', { email: 'new@example.com' }, 'user-1');

      expect(result.message).toBe('Member added successfully');
    });

    it('should return message if user not registered', async () => {
      const investerMembership = { role: 'creator' };
      prismaService.workspaceMember.findFirst
        .mockResolvedValueOnce(investerMembership)
        .mockResolvedValueOnce(null);
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.inviteMember('ws-1', { email: 'new@example.com' }, 'user-1');

      expect(result.message).toContain('Invitation email sent');
    });

    it('should throw BadRequestException if already a member', async () => {
      const investerMembership = { role: 'creator' };
      prismaService.workspaceMember.findFirst
        .mockResolvedValueOnce(investerMembership)
        .mockResolvedValueOnce({}); // existing member

      await expect(service.inviteMember('ws-1', { email: 'existing@example.com' }, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member if actor has permission', async () => {
      const actorMembership = { role: 'admin' };
      const workspace = { ownerId: 'owner-1' };
      prismaService.workspaceMember.findFirst.mockResolvedValue(actorMembership);
      prismaService.workspace.findUnique.mockResolvedValue(workspace);
      prismaService.workspaceMember.deleteMany.mockResolvedValue({} as any);

      await service.removeMember('ws-1', 'user-2', 'user-1');

      expect(prismaService.workspaceMember.deleteMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', userId: 'user-2' },
      });
    });

    it('should throw BadRequestException when trying to remove owner', async () => {
      const actorMembership = { role: 'creator' };
      const workspace = { ownerId: 'user-2' }; // same as target userId
      prismaService.workspaceMember.findFirst.mockResolvedValue(actorMembership);
      prismaService.workspace.findUnique.mockResolvedValue(workspace);

      await expect(service.removeMember('ws-1', 'user-2', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMembers', () => {
    it('should return list of members', async () => {
      const members = [mockWorkspaceMember];
      prismaService.workspaceMember.findMany.mockResolvedValue(members);

      const result = await service.getMembers('ws-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('role', 'creator');
      expect(result[0]).toHaveProperty('user');
    });
  });
});
