import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResponse = {
    accessToken: 'jwt-token',
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User', avatarUrl: null },
    workspace: { id: 'ws-1', name: "Test User's Workspace", slug: 'test-user-workspace' },
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    emailVerified: false,
    createdAt: expect.any(Date),
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      getProfile: jest.fn(),
      validateUser: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register and return result', async () => {
      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register({ email: 'test@example.com', password: 'pass', name: 'Test' });

      expect(authService.register).toHaveBeenCalledWith({ email: 'test@example.com', password: 'pass', name: 'Test' });
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('login', () => {
    it('should call authService.login and return result', async () => {
      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login({ req: {} as any }, { email: 'test@example.com', password: 'pass' });

      expect(authService.login).toHaveBeenCalledWith({ email: 'test@example.com', password: 'pass' });
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('getProfile', () => {
    it('should call authService.getProfile with user id from request', async () => {
      authService.getProfile.mockResolvedValue(mockUser);

      const result = await controller.getProfile({ user: { id: 'user-1' } } as any);

      expect(authService.getProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should return empty object', async () => {
      const result = await controller.logout({ user: { id: 'user-1' } } as any);
      expect(result).toEqual({});
    });
  });

  describe('refreshToken', () => {
    it('should return new access token for valid user', async () => {
      authService.validateUser.mockResolvedValue(mockUser);
      authService['generateToken'] = jest.fn().mockResolvedValue('new-jwt-token');

      const result = await controller.refreshToken({ user: { id: 'user-1' } } as any);

      expect(authService.validateUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ accessToken: 'new-jwt-token' });
    });

    it('should throw UnauthorizedException if user invalid', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(controller.refreshToken({ user: { id: 'user-1' } } as any))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
