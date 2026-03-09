import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async scanContent(
    workspaceId: string,
    userId: string,
    contentId: string,
    scanType: 'sensitive' | 'copyright' | 'brand_safety' | 'regulatory',
    triggeredBy?: string,
  ) {
    // Verify content exists and belongs to workspace
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, workspaceId },
    });

    if (!content) {
      throw new BadRequestException('Content not found');
    }

    // Create scan record
    const scan = await this.prisma.complianceScan.create({
      data: {
        id: uuidv4(),
        contentId,
        workspaceId,
        scanType,
        triggeredBy: triggeredBy || userId,
        status: 'pending',
      },
    });

    // In production, this would trigger a background job (Bull queue)
    // For now, we'll simulate a simple scan with basic checks
    this.logger.log(`Compliance scan triggered: ${scan.id} for content ${contentId}, type: ${scanType}`);

    // Simulate scan process (async)
    setTimeout(async () => {
      try {
        // Basic heuristic checks (replace with actual AI service)
        const riskLevel = await this.performScan(content, scanType);
        
        await this.prisma.complianceScan.update({
          where: { id: scan.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            overallRisk: riskLevel,
            violations: riskLevel !== 'low' ? this.generateMockViolations(riskLevel) : [],
          },
        });

        this.logger.log(`Compliance scan completed: ${scan.id}, risk: ${riskLevel}`);
      } catch (error) {
        await this.prisma.complianceScan.update({
          where: { id: scan.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
          },
        });
        this.logger.error(`Compliance scan failed: ${scan.id}`, error);
      }
    }, 1000);

    return scan;
  }

  async getScanResults(workspaceId: string, contentId: string, userId: string) {
    const scans = await this.prisma.complianceScan.findMany({
      where: { workspaceId, contentId },
      orderBy: { createdAt: 'desc' },
    });

    return scans;
  }

  async getScanById(workspaceId: string, scanId: string, userId: string) {
    const scan = await this.prisma.complianceScan.findFirst({
      where: { id: scanId, workspaceId },
    });

    if (!scan) {
      throw new BadRequestException('Scan not found');
    }

    return scan;
  }

  async overrideScan(
    workspaceId: string,
    scanId: string,
    userId: string,
    reason: string,
  ) {
    const scan = await this.prisma.complianceScan.findFirst({
      where: { id: scanId, workspaceId },
    });

    if (!scan) {
      throw new BadRequestException('Scan not found');
    }

    if (scan.status !== 'completed') {
      throw new BadRequestException('Can only override completed scans');
    }

    // Only creator/admin can override
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!membership || !['creator', 'admin'].includes(membership.role)) {
      throw new BadRequestException('Insufficient permissions to override scan');
    }

    const updated = await this.prisma.complianceScan.update({
      where: { id: scanId },
      data: {
        userOverride: true,
        overrideReason: reason,
        overrideBy: userId,
        overrideAt: new Date(),
        status: 'completed', // Keep status completed but marked as overridden
      },
    });

    this.logger.log(`Compliance scan overridden: ${scanId} by user ${userId}, reason: ${reason}`);

    return updated;
  }

  private async performScan(content: any, scanType: string): Promise<'low' | 'medium' | 'high' | 'critical'> {
    // Simple heuristic for MVP
    // In production, this would call external AI/compliance service
    
    const text = (content.body + ' ' + (content.summary || '')).toLowerCase();
    
    // Very basic keyword detection (expand in production)
    const sensitiveWords = ['spam', 'scam', 'hack', 'crack', 'virus'];
    const brandSafetyWords = ['nsfw', 'explicit', 'violence', 'hate'];
    
    let riskScore = 0;
    
    if (scanType === 'sensitive' || scanType === 'regulatory') {
      const found = sensitiveWords.filter(w => text.includes(w));
      riskScore += found.length * 2;
    }
    
    if (scanType === 'brand_safety') {
      const found = brandSafetyWords.filter(w => text.includes(w));
      riskScore += found.length * 3;
    }
    
    // Length check
    if (text.length > 5000) {
      riskScore += 1;
    }
    
    if (riskScore >= 10) return 'critical';
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  private generateMockViolations(riskLevel: string): any[] {
    const violations = [];
    if (riskLevel === 'medium' || riskLevel === 'high' || riskLevel === 'critical') {
      violations.push({
        type: 'keyword_match',
        description: 'Potentially inappropriate content detected',
        severity: riskLevel,
        suggestion: 'Review content before publishing',
      });
    }
    return violations;
  }
}