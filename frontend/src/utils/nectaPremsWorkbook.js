const columnIndex = (cellRef = "") => {
  const letters = String(cellRef).match(/[A-Z]+/i)?.[0] || "";
  let result = 0;
  for (const char of letters.toUpperCase()) {
    result = result * 26 + char.charCodeAt(0) - 64;
  }
  return result - 1;
};

const readZipEntries = async (buffer) => {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;

  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This file is not a valid .xlsx workbook.");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map();

  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("The Excel workbook directory is damaged.");
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    let data;
    if (method === 0) {
      data = compressed;
    } else if (method === 8) {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("Your browser cannot unpack this Excel file. Please use an up-to-date Chrome or Edge browser.");
      }
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error("This Excel workbook uses an unsupported compression method.");
    }
    entries.set(name, new TextDecoder("utf-8").decode(data));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const parseSharedStrings = (xml) => {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t")).map((node) => node.textContent || "").join("")
  );
};

const parseSheet = (xml, sharedStrings) => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Excel worksheet XML could not be read.");
  return Array.from(doc.getElementsByTagName("row")).map((row) => {
    const values = [];
    for (const cell of Array.from(row.getElementsByTagName("c"))) {
      const index = columnIndex(cell.getAttribute("r"));
      const type = cell.getAttribute("t");
      let value = "";
      if (type === "inlineStr") {
        value = Array.from(cell.getElementsByTagName("t")).map((n) => n.textContent || "").join("");
      } else {
        const raw = cell.getElementsByTagName("v")[0]?.textContent || "";
        value = type === "s" ? (sharedStrings[Number(raw)] ?? "") : raw;
      }
      values[index] = String(value ?? "").trim();
    }
    return values.map((value) => String(value ?? "").trim());
  });
};

const normalizeHeader = (value) =>
  String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, " ").replace(/[^A-Z0-9 /]/g, "");

const HEADER_ALIASES = {
  SERIAL: ["SERIAL", "S/N", "SN"],
  REGISTRATION_TYPE: ["REGISTRATION TYPE", "REGISTRATION"],
  EXAM_NUMBER: ["EXAM NUMBER", "EXAMINATION NUMBER", "INDEX NUMBER"],
  EXAM_YEAR: ["EXAM YEAR", "YEAR"],
  FIRST_NAME: ["FIRST NAME", "GIVEN NAME"],
  OTHER_NAME: ["OTHER NAME", "MIDDLE NAME"],
  SURNAME: ["SURNAME", "LAST NAME", "FAMILY NAME"],
  SEX: ["SEX", "GENDER"],
  DATE_OF_BIRTH: ["DATE OF BIRTH", "DOB", "BIRTH DATE"],
  ADMISSION_NUMBER: ["ADMISSION NUMBER", "ADMISSION NO", "ADMISSION NO."],
  STREAM_TRADE: ["STREAM/TRADE", "STREAM / TRADE", "STREAM", "TRADE"],
};

export async function parseNectaWorkbook(file) {
  if (!file || !/\.xlsx$/i.test(file.name)) {
    throw new Error("Select the original NECTA PReMS Excel template (.xlsx).");
  }
  const zip = await readZipEntries(await file.arrayBuffer());
  const workbookXml = zip.get("xl/workbook.xml");
  if (!workbookXml) throw new Error("The workbook does not contain an Excel worksheet.");

  const workbook = new DOMParser().parseFromString(workbookXml, "application/xml");
  const firstSheet = workbook.getElementsByTagName("sheet")[0];
  if (!firstSheet) throw new Error("No worksheet was found in this Excel file.");

  const relationId = firstSheet.getAttribute("r:id");
  const relsXml = zip.get("xl/_rels/workbook.xml.rels");
  const rels = new DOMParser().parseFromString(relsXml || "", "application/xml");
  const relation = Array.from(rels.getElementsByTagName("Relationship"))
    .find((item) => item.getAttribute("Id") === relationId);
  let target = relation?.getAttribute("Target");
  if (!target) throw new Error("Could not locate the first worksheet in this workbook.");
  target = target.replace(/^\//, "");
  const sheetPath = target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
  const sheetXml = zip.get(sheetPath) || zip.get(`xl/${target.replace(/^\.\//, "")}`);
  if (!sheetXml) throw new Error("The first worksheet could not be opened.");

  const sharedStrings = parseSharedStrings(zip.get("xl/sharedStrings.xml"));
  const rows = parseSheet(sheetXml, sharedStrings);
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return ["FIRST_NAME", "SURNAME", "ADMISSION_NUMBER"].every((key) =>
      HEADER_ALIASES[key].some((alias) => normalized.includes(normalizeHeader(alias)))
    );
  });
  if (headerIndex < 0) {
    throw new Error("NECTA template headers were not recognized. Use the PReMS Admission Uploading template.");
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const positions = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    positions[key] = headers.findIndex((header) =>
      aliases.some((alias) => normalizeHeader(alias) === header)
    );
  }

  const valueAt = (row, key) => {
    const index = positions[key];
    return index < 0 ? "" : String(row[index] ?? "").trim();
  };
  const students = rows.slice(headerIndex + 1)
    .filter((row) => row.some((value) => String(value ?? "").trim()))
    .map((row, index) => ({
      source_row: headerIndex + index + 2,
      serial: valueAt(row, "SERIAL"),
      registration_type: valueAt(row, "REGISTRATION_TYPE"),
      exam_number: valueAt(row, "EXAM_NUMBER"),
      exam_year: valueAt(row, "EXAM_YEAR"),
      first_name: valueAt(row, "FIRST_NAME"),
      middle_name: valueAt(row, "OTHER_NAME"),
      last_name: valueAt(row, "SURNAME"),
      gender: valueAt(row, "SEX"),
      date_of_birth: valueAt(row, "DATE_OF_BIRTH"),
      admission_number: valueAt(row, "ADMISSION_NUMBER"),
      stream: valueAt(row, "STREAM_TRADE"),
    }));

  if (!students.length) throw new Error("No student rows were found below the template headers.");

  const metadata = {};
  for (const row of rows.slice(0, headerIndex)) {
    const text = row.filter(Boolean).join(" ").trim();
    const match = text.match(/^(REGION|DISTRICT|SCHOOL NUMBER|SCHOOL NAME|FORM)(?:\s*[:=]\s*|\s+)(.*)$/i);
    if (match) metadata[match[1].toUpperCase()] = match[2].trim();
  }

  return { metadata, students, worksheet: firstSheet.getAttribute("name") || "Sheet1" };
}
