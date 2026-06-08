import { prisma } from '../src/config/prisma.js';

async function main() {
  const displayId = (process.argv[2] || 'SIA00299').trim();

  const user = await prisma.users.findUnique({
    where: { display_id: displayId },
    select: {
      id: true,
      display_id: true,
      name: true,
      phone: true,
      transaction_pin: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!user) {
    console.log(`❌ User with display_id ${displayId} not found`);
    process.exitCode = 1;
    return;
  }

  const pin = user.transaction_pin;
  console.log('👤 User:', {
    id: String(user.id),
    display_id: user.display_id,
    name: user.name || null,
    phone: user.phone || null,
    created_at: user.created_at?.toISOString?.(),
    updated_at: user.updated_at?.toISOString?.(),
  });

  // IMPORTANT: Do NOT print the PIN value.
  console.log('🔐 Transaction PIN status:', {
    is_set: !!pin,
    length: pin ? pin.length : 0,
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

