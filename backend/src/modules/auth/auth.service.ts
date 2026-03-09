import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { AuthLogService } from './auth-log.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authLogService: AuthLogService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, name } = registerDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    // Create default workspace for the user
    const workspace = await this.workspacesService.createWorkspace({
      name: `${name}'s Workspace`,
      ownerId: user.id,
    });

    // Add user as creator member
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'creator',
      },
    });

    // Generate JWT
    const accessToken = await this.generateToken(user);

    // Log successful registration
    await this.authLogService.logRegistration(user.id, {
      ip: '',
      userAgent: '',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        workspaceMembers: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      // Log failed attempt
      await this.authLogService.logFailedLogin(user.id, 'invalid_password');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check rate limiting
    const attemptCount = await this.authLogService.getRecentFailedAttempts(user.id);
    if (attemptCount >= 5) {
      throw new BadRequestException('Too many failed attempts. Please try again later.');
    }

    // Generate JWT
    const accessToken = await this.generateToken(user);

    // Log successful login
    await this.authLogService.logLogin(user.id, {
      ip: '',
      userAgent: '',
    });

    // Get primary workspace (first one, or the one where user is creator)
    const primaryWorkspace = user.workspaceMembers[0]?.workspace;

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspace: primaryWorkspace ? {
        id: primaryWorkspace.id,
        name: primaryWorkspace.name,
        slug: primaryWorkspace.slug,
      } : null,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return null;
    }

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        createdAt: true,
        workspaceMembers: {
          include: {
            workspace: true,
          },
        },
        apiKeys: {
          where: { revoked: false, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      workspaces: user.workspaceMembers.map(m => m.workspace),
      apiKeys: user.apiKeys,
    };
  }

  private async generateToken(user: any): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: [], // Will be populated from workspace membership
    };

    return this.jwtService.signAsync(payload);
  }
}
