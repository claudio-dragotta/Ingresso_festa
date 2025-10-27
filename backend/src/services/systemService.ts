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
  const [total, checkedIn, pending] = await Promise.all([
    prisma.invitee.count(),
    prisma.invitee.count({ where: { status: "CHECKED_IN" } }),
    prisma.invitee.count({ where: { status: "PENDING" } }),
  ]);

  const capacity = await prisma.systemConfig.findFirst();

  return {
    total,
    checkedIn,
    pending,
    cancelled: total - checkedIn - pending,
    eventStatus: capacity?.eventStatus ?? "ACTIVE",
  };
};
