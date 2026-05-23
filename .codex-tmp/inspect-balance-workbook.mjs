import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool'

const workbookPath = 'C:\\Users\\admin\\Desktop\\狗骰乱斗.xlsx'
const input = await FileBlob.load(workbookPath)
const workbook = await SpreadsheetFile.importXlsx(input)

const sheets = await workbook.inspect({
  kind: 'sheet',
  include: 'id,name',
  maxChars: 4000,
})
console.log('SHEETS')
console.log(sheets.ndjson)

for (const term of ['拍拍熊', '淬毒狗牙', '毒牙', 'patting-bear', 'poisoned-dog-fang']) {
  const result = await workbook.inspect({
    kind: 'match',
    searchTerm: term,
    options: { maxResults: 50 },
    maxChars: 8000,
  })
  console.log(`MATCH ${term}`)
  console.log(result.ndjson)
}
