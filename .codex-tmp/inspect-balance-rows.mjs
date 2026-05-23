import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool'

const workbookPath = 'C:\\Users\\admin\\Desktop\\狗骰乱斗.xlsx'
const input = await FileBlob.load(workbookPath)
const workbook = await SpreadsheetFile.importXlsx(input)

for (const range of [
  '通用装备!A1:AC3',
  '通用装备!A32:AC33',
  '数值模型-装备期望!A1:Q3',
  '数值模型-装备期望!A38:Q39',
  '数值模型-平衡看板!A1:D31',
]) {
  const result = await workbook.inspect({
    kind: 'table',
    range,
    include: 'values,formulas',
    tableMaxRows: 40,
    tableMaxCols: 30,
    tableMaxCellChars: 120,
    maxChars: 12000,
  })
  console.log(`RANGE ${range}`)
  console.log(result.ndjson)
}
