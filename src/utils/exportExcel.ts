import * as XLSX from 'xlsx';

/**
 * Exports data to an Excel file.
 * @param data Array of objects to be exported.
 * @param fileName Name of the resulting Excel file (without .xlsx extension).
 */
export const exportToExcel = (data: any[], fileName: string) => {
  if (!data || data.length === 0) {
    return;
  }

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert the array of objects to a worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // ตรวจสอบว่าบรรทัดเกือบสุดท้ายมีคำว่า "ลงชื่อ" หรือไม่ (เพื่อไม่ให้กระทบการส่งออก Excel จากหน้าอื่น)
  const hasSignature = data.length >= 2 && 
    (String(data[data.length - 2]['ชั้น/ห้อง'] || '').includes('ลงชื่อ') || 
     String(data[data.length - 2]['ส่วนสูงล่าสุด (ซม.)'] || '').includes('ลงชื่อ'));

  if (hasSignature) {
    const signRow1 = data.length - 1; // แถว "ลงชื่อ..."
    const signRow2 = data.length;     // แถว "(...)"

    worksheet['!merges'] = [
      { s: { r: signRow1, c: 2 }, e: { r: signRow1, c: 5 } }, 
      { s: { r: signRow2, c: 2 }, e: { r: signRow2, c: 5 } }, 
      { s: { r: signRow1, c: 11 }, e: { r: signRow1, c: 15 } },
      { s: { r: signRow2, c: 11 }, e: { r: signRow2, c: 15 } } 
    ];
  }

  // ตั้งค่าความกว้างคอลัมน์เบื้องต้นให้สวยงาม
  worksheet['!cols'] = [
    { wch: 8 },  // A: เลขที่
    { wch: 25 }, // B: ชื่อ-นามสกุล
    { wch: 10 }, // C: ชั้น/ห้อง
  ];

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานสรุป');

  // Export the workbook
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
