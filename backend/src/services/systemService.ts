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

export const getDashboardMetrics = async (eventId: string) => {
  const [total, entered, notEntered, pagantiTotal, greenTotal] = await Promise.all([
    prisma.invitee.count({ where: { eventId } }),
    prisma.invitee.count({ where: { eventId, hasEntered: true } }),
    prisma.invitee.count({ where: { eventId, hasEntered: false } }),
    prisma.invitee.count({ where: { eventId, listType: "PAGANTE" } }),
    prisma.invitee.count({ where: { eventId, listType: "GREEN" } }),
  ]);

  // Recupera lo stato dell'evento direttamente dalla tabella Event
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true } });

  return {
    total,
    entered,
    notEntered,
    pagantiTotal,
    greenTotal,
    eventStatus: event?.status ?? "ACTIVE",
  };
};
