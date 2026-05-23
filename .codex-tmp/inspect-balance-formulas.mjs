import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool'

const workbookPath = 'C:\\Users\\admin\\Desktop\\狗骰乱斗.xlsx'
const input = await FileBlob.load(workbookPath)
const workbook = await SpreadsheetFile.importXlsx(input)

for (const range of ['通用装备!A32:AC33', '数值模型-装备期望!A38:Q39', '数值模型-平衡看板!A18:D19']) {
  const result = await workbook.inspect({
    kind: 'formula',
    range,
    maxChars: 8000,
    options: { maxResults: 100 },
  })
  console.log(`FORMULAS ${range}`)
  console.log(result.ndjson)
}
