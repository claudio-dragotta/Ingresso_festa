import { promises as fs } from "fs";
import XLSX from "xlsx";
import { ListType } from "@prisma/client";

export interface ImportInvitee {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  listType: ListType;
  paymentType?: string;
}

const normalizeString = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return String(value);
};

export const parseFileBuffer = (buffer: Buffer): ImportInvitee[] => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const invitees: ImportInvitee[] = [];

  for (const row of rows) {
    const firstName = normalizeString(row["Nome"] ?? row["FirstName"] ?? row["First Name"]);
    const lastName = normalizeString(row["Cognome"] ?? row["LastName"] ?? row["Last Name"]);
    const email = normalizeString(row["Email"]);
    const phone = normalizeString(row["Telefono"] ?? row["Phone"]);
    const paymentType = normalizeString(row["Tipologia Pagamento"] ?? row["PaymentType"] ?? row["Pagamento"]);
    const listTypeStr = normalizeString(row["Tipo"] ?? row["ListType"] ?? row["Type"]);

    // Se non specificato, determina dal paymentType: se c'è paymentType è PAGANTE, altrimenti GREEN
    let listType: ListType = 'PAGANTE';
    if (listTypeStr) {
      listType = listTypeStr.toUpperCase() === 'GREEN' ? 'GREEN' : 'PAGANTE';
    } else if (!paymentType) {
      listType = 'GREEN';
    }

    if (!firstName || !lastName) {
      continue;
    }

    invitees.push({
      firstName,
      lastName,
      email,
      phone,
      listType,
      paymentType: listType === 'PAGANTE' ? paymentType : undefined,
    });
  }

  return invitees;
};

export const parseFilePath = async (path: string) => {
  const buffer = await fs.readFile(path);
  return parseFileBuffer(buffer);
};
