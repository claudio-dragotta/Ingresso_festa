import { EventStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const ensureSystemConfig = async () => {
  const existing = await prisma.systemConfig.findFirst();
  if (!existing) {
    await prisma.systemConfig.create({
      data: {
        eventName: "Ingresso Festa",
        eventStatus: "ACTIVE",
      },
    });
  }
};

export const getSystemConfig = () => prisma.systemConfig.findFirst();

export const updateSystemStatus = async (status: EventStatus) => {
  const config = await prisma.systemConfig.findFirst();
  if (!config) {
    return prisma.systemConfig.create({
      data: {
        eventStatus: status,
        eventName: "Ingresso Festa",
      },
    });
  }

  return prisma.systemConfig.update({
    where: { id: config.id },
    data: { eventStatus: status },
  });
};

export const getDashboardMetrics = async () => {
  const [total, entered, notEntered, pagantiTotal, greenTotal] = await Promise.all([
    prisma.invitee.count(),
    prisma.invitee.count({ where: { hasEntered: true } }),
    prisma.invitee.count({ where: { hasEntered: false } }),
    prisma.invitee.count({ where: { listType: 'PAGANTE' } }),
    prisma.invitee.count({ where: { listType: 'GREEN' } }),
  ]);

  const capacity = await prisma.systemConfig.findFirst();

  return {
    total,
    entered,
    notEntered,
    pagantiTotal,
    greenTotal,
    eventStatus: capacity?.eventStatus ?? "ACTIVE",
  };
};
