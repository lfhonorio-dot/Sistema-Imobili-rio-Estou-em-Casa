import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetPlatformConfigDto, SetFeatureFlagDto, SetWorkspacePlanDto, CompleteOnboardingStepDto } from './admin.dto';

const ONBOARDING_STEPS = ['CREATE_PIPELINE', 'ADD_CONTACT', 'ADD_PROPERTY', 'CONFIGURE_WHATSAPP', 'CREATE_AUTOMATION', 'INVITE_USER'];

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const [workspaces, users, properties, contacts] = await Promise.all([
      this.prisma.workspace.count(),
      this.prisma.workspaceUser.count(),
      this.prisma.property.count(),
      this.prisma.contact.count(),
    ]);
    return { workspaces, users, properties, contacts };
  }

  async getPlatformConfigs() {
    return this.prisma.platformConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async setPlatformConfig(dto: SetPlatformConfigDto) {
    return this.prisma.platformConfig.upsert({
      where: { key: dto.key },
      update: { value: dto.value, description: dto.description },
      create: { key: dto.key, value: dto.value, description: dto.description },
    });
  }

  async getFeatureFlags() {
    return this.prisma.featureFlag.findMany();
  }

  async setFeatureFlag(dto: SetFeatureFlagDto) {
    return this.prisma.featureFlag.upsert({
      where: { key: dto.key },
      update: { enabled: dto.enabled, description: dto.description, workspaceIds: dto.workspaceIds },
      create: { key: dto.key, enabled: dto.enabled, description: dto.description, workspaceIds: dto.workspaceIds ?? [] },
    });
  }

  async isFeatureEnabled(key: string, workspaceId: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) return { enabled: false };
    const enabled = flag.enabled || flag.workspaceIds.includes(workspaceId);
    return { enabled };
  }

  async getWorkspacePlan(workspaceId: string) {
    const plan = await this.prisma.workspacePlan.findFirst({ where: { workspaceId } });
    if (!plan) {
      return { workspaceId, plan: 'FREE', maxUsers: 3, maxProperties: 50, maxContacts: 500, features: [], validUntil: null };
    }
    return plan;
  }

  async setWorkspacePlan(workspaceId: string, dto: SetWorkspacePlanDto) {
    return this.prisma.workspacePlan.upsert({
      where: { workspaceId },
      update: { plan: dto.plan, maxUsers: dto.maxUsers, maxProperties: dto.maxProperties, maxContacts: dto.maxContacts, features: dto.features },
      create: { workspaceId, plan: dto.plan, maxUsers: dto.maxUsers ?? 3, maxProperties: dto.maxProperties ?? 50, maxContacts: dto.maxContacts ?? 500, features: dto.features ?? [] },
    });
  }

  async getOnboardingSteps(workspaceId: string) {
    const dbSteps = await this.prisma.onboardingStep.findMany({ where: { workspaceId } });
    const dbMap = new Map(dbSteps.map(s => [s.step, s]));
    return ONBOARDING_STEPS.map(step => {
      const db = dbMap.get(step);
      return { step, completed: db?.completed ?? false, completedAt: db?.completedAt ?? null };
    });
  }

  async completeOnboardingStep(workspaceId: string, dto: CompleteOnboardingStepDto) {
    await this.prisma.onboardingStep.upsert({
      where: { workspaceId_step: { workspaceId, step: dto.step } },
      update: { completed: true, completedAt: new Date() },
      create: { workspaceId, step: dto.step, completed: true, completedAt: new Date() },
    });
    return this.getOnboardingSteps(workspaceId);
  }

  async getPlatformHealth() {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }
    return { status: 'ok', timestamp: new Date().toISOString(), services: { database: dbStatus, cache: 'ok' } };
  }
}
