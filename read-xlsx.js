import * as xlsx from 'xlsx';

const workbook = xlsx.readFile('c:\\Users\\adira\\Desktop\\REPOSITORIES\\blip\\Tracker.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(worksheet);
console.log(data.slice(0, 2));
