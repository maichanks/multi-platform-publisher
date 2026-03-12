/**
 * Data migration: create default tenant and assign all existing workspaces to it.
 * Run with: npx ts-node scripts/migrate-tenants.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting tenant data migration...');

  // Check if default tenant already exists
  let defaultTenant = await prisma.tenant.findUnique({
    where: { slug: 'default' },
  });

  if (!defaultTenant) {
    console.log('📦 Creating default tenant...');
    defaultTenant = await prisma.tenant.create({
      data: {
        name: 'Default Tenant',
        slug: 'default',
      },
    });
    console.log(`✅ Created default tenant: ${defaultTenant.id}`);
  } else {
    console.log(`ℹ️  Default tenant exists: ${defaultTenant.id}`);
  }

  // Find all workspaces without tenantId
  const workspaces = await prisma.workspace.findMany({
    where: { tenantId: null },
  });

  console.log(`🔍 Found ${workspaces.length} workspaces without tenant assignment`);

  if (workspaces.length > 0) {
    console.log('🔧 Assigning workspaces to default tenant...');
    for (const ws of workspaces) {
      await prisma.workspace.update({
        where: { id: ws.id },
        data: { tenantId: defaultTenant.id },
      });
      console.log(`   • Workspace "${ws.name}" (${ws.id}) assigned`);
    }
    console.log('✅ All workspaces assigned to default tenant');
  } else {
    console.log('✅ No workspaces need assignment');
  }

  console.log('🎉 Migration complete');
}

migrate()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
